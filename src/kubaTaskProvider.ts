import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import * as os from 'os';
import { wsCfg } from './config';
import { LogReader } from './logReader';

const uniqueFilename = require('unique-filename');

interface KubaTaskDefinition extends vscode.TaskDefinition {

    label: string;
    command: string;
    args: string[];
}

export type KubaTaskName = 'dotnet-build' | 'tilt-up';

export class KubaTaskProvider implements vscode.TaskProvider {
    static kubaType: string = 'kuba';
    static tiltUp: string = 'tilt-up';
    static dotnetBuild: string = 'dotnet-build';
    private static tiltAppReadyRegExp = new RegExp(wsCfg<RegExp>('tilt.appReadyRegEx'), "gm");
    private tiltOutDirWatcher: fs.FSWatcher | undefined;
    private tiltOutDir: string = path.join(os.tmpdir(), "tilt");
    private tiltOutFileWatcher: fs.FSWatcher | undefined;
    private tiltOutFileFullName: string = uniqueFilename(this.tiltOutDir, "tilt");
    private tiltOutFileName: string = path.basename(this.tiltOutFileFullName);
    private output: vscode.OutputChannel;

    constructor(channel: vscode.OutputChannel) {
        this.output = channel;
    }

    public provideTasks(): Thenable<vscode.Task[]> | undefined { return this.getKubaTasks(); }
    public async resolveTask(_task: vscode.Task): Promise<vscode.Task | undefined> { return undefined; }

    public async runDotnetBuild() {
        const taskName: KubaTaskName = 'dotnet-build';
        const buildTask = await this.fetchTask(taskName);
        if (buildTask && !this.isTaskRunning(taskName)) {
            await vscode.tasks.executeTask(buildTask);
        }
    }

    public async runTiltUp() {
        const taskName: KubaTaskName = 'tilt-up';
        const tiltTask = await this.fetchTask(taskName);
        if (tiltTask && !this.isTaskRunning(taskName)) {
            try {

                if (!fs.existsSync(wsCfg<string>('build.outputDir'))) {
                    await this.runDotnetBuild();
                }

                if (!fs.existsSync(this.tiltOutDir)) {
                    process.umask(0o000);
                    fs.mkdirSync(this.tiltOutDir, 0o777);
                }
                await vscode.tasks.executeTask(tiltTask);
                const logReader = new LogReader(this.tiltOutFileFullName);
                let foundReadyMessage = false;
                await this.waitForTiltOutput();

                await logReader.stream(async chunk => {
                    if (!foundReadyMessage) {

                        const match = KubaTaskProvider.tiltAppReadyRegExp.exec(chunk);
                        if (match) { foundReadyMessage = true; }
                    }
                });

                if (!foundReadyMessage) {
                    this.output.appendLine("Could not find a matching readiness message. Assuming Tilt is up and running.");
                }

            } catch (r) {
                console.log(r);
            }
        }
    }

    private async waitForTiltOutput() {
        var tiltStarted = new Promise<void>((resolve, _) => {

            this.tiltOutDirWatcher = fs.watch(this.tiltOutDir, (event, name) => {
                if (event === 'change' && name === this.tiltOutFileName) {
                    resolve();
                }
            });
        });

        const timeout = new Promise<void>((resolve, _) => { setTimeout(() => resolve(), 1000); });

        var result = await Promise.race([tiltStarted, timeout]);
        this.tiltOutDirWatcher?.close();
        return result;
    }

    public async onTiltExited() {

        if (this.tiltOutFileWatcher) { this.tiltOutFileWatcher.close(); }
        if (this.tiltOutFileFullName) {
            fs.unlink(this.tiltOutFileFullName, (err) => {
                if (err) {
                    void vscode.window.showErrorMessage(`${err}`);
                }
            });
        }
    }

    public isTaskRunning(task: KubaTaskName) {
        const isRunning = vscode.tasks.taskExecutions.some(t => t.task.definition.type === KubaTaskProvider.kubaType && t.task.name === task);
        return isRunning;
    }
    public focusOn(task: KubaTaskName) {
        let terminal = vscode.window.terminals.find(x => x.name === `Task - ${task}`);
        if (terminal) { terminal.show(); }
    }

    private async fetchTask(task: KubaTaskName) {
        const kubaTasks = await vscode.tasks.fetchTasks({ type: KubaTaskProvider.kubaType });
        return kubaTasks.find(t => t.name === task);
    }
    private async getKubaTasks(): Promise<vscode.Task[]> {
        if (!vscode.workspace.rootPath) { return []; }

        const relativeTiltfilePath = wsCfg<string>("tilt.tiltfilePath") || "Tiltfile";

        let tiltDef: KubaTaskDefinition = {
            type: KubaTaskProvider.kubaType,
            label: KubaTaskProvider.tiltUp,
            command: 'tilt',
            args: ["up", "--file=" + path.join("${workspaceFolder}", relativeTiltfilePath), "--hud=false", "--debug=true", "|", "tee", `"${this.tiltOutFileFullName}"`]
        };
        let tiltExecution = new vscode.ShellExecution(tiltDef.command, tiltDef.args);
        let tiltUpTask = new vscode.Task(tiltDef, vscode.TaskScope.Workspace, tiltDef.label, 'Kuba', tiltExecution, ["$tilt"]);

        let relativeSrcDir = wsCfg<string>("build.srcDir") || "src";
        let relativeBuildOutputDir = wsCfg<string>("build.outputDir") || "dev/bin";

        let buildDef: KubaTaskDefinition = {
            type: KubaTaskProvider.kubaType,
            label: KubaTaskProvider.dotnetBuild,
            command: 'dotnet',
            args: [
                "build", path.join("${workspaceFolder}", relativeSrcDir), "/property:GenerateFullPaths=true", "/consoleloggerparameters:NoSummary",
                "--output", path.join("${workspaceFolder}", relativeBuildOutputDir)
            ]
        };

        let buildExecution = new vscode.ProcessExecution(buildDef.command, buildDef.args);
        let buildTask = new vscode.Task(buildDef, vscode.TaskScope.Workspace, buildDef.label, 'Kuba', buildExecution, ["$msCompile"]);

        tiltUpTask.group = vscode.TaskGroup.Build;
        buildTask.group = vscode.TaskGroup.Build;
        return [tiltUpTask, buildTask];
    }
}
