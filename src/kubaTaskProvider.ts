import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
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
    static KubaType: string = 'kuba';
    static TiltUp: string = 'tilt-up';
    static DotnetBuild: string = 'dotnet-build';
    private TiltOutDirWatcher: fs.FSWatcher | undefined;
    private TiltOutDir : string = path.join(os.tmpdir(), "tilt");
    private TiltOutFileWatcher: fs.FSWatcher | undefined;
    private TiltOutFileFullName : string = uniqueFilename(this.TiltOutDir, "tilt");
    private TiltOutFileName : string = path.basename(this.TiltOutFileFullName);

    public provideTasks(): Thenable<vscode.Task[]> | undefined { return this.getKubaTasks(); }
    public async resolveTask(_task: vscode.Task): Promise<vscode.Task | undefined> { return undefined; }
    public async runTiltUp()
    {
        const task:KubaTaskName = 'tilt-up';
        const tiltUp = await this.fetchTask(task);
        if (tiltUp && !this.isTaskRunning(task)) 
        { 
            try {

                if (!fs.existsSync(this.TiltOutDir)) {
                    fs.mkdir(this.TiltOutDir, err => { 
                        if (err) { vscode.window.showErrorMessage(`${err}`); }
                     });					
                }
                await vscode.tasks.executeTask(tiltUp);
                const logReader = new LogReader(this.TiltOutFileFullName);
                let tiltReady = false;
                while (this.isTaskRunning('tilt-up') && !tiltReady)
                {
                   await this.waitForTiltOutput();
                  
                   logReader.Stream(ln => { 
                     if (ln.indexOf("Forwarding") > -1) { tiltReady = true; }
                   });
                }

                if (!this.TiltOutFileFullName) { return; }

            } catch (r) {
                console.log(r);
            }
        }	
    }

    private async waitForTiltOutput()
    {
        var tiltStarted = new Promise<void>((resolve, _) => {
            
            this.TiltOutDirWatcher = fs.watch(this.TiltOutDir, (event, name) => {
                if (event === 'change' && name === this.TiltOutFileName) {
                    resolve();
                }
            });
        });

        const timeout = new Promise<void>((resolve, _) => { setTimeout(() => resolve(), 1000); });

        var result = await Promise.race([tiltStarted, timeout]);
        this.TiltOutDirWatcher?.close();
        return result;
    }

    public async onTiltExited() {
        
        if (this.TiltOutFileWatcher) {this.TiltOutFileWatcher.close();}
        if (this.TiltOutFileFullName) {
            fs.unlink(this.TiltOutFileFullName, (err) => {
                if (err) { vscode.window.showErrorMessage(`${err}`); }
            });
        }		
    }

    public isTaskRunning(task:KubaTaskName)
    {
        const isRunning = vscode.tasks.taskExecutions.some(t => t.task.definition.type === KubaTaskProvider.KubaType && t.task.name === task);
        return isRunning;
    }
    public focusOn(task:KubaTaskName)
    {
        let terminal = vscode.window.terminals.find(x => x.name === `Task - ${task}`);
        if (terminal) { terminal.show(); }
    }

    private async fetchTask(task: KubaTaskName)
    {
        const kubaTasks = await vscode.tasks.fetchTasks({type:KubaTaskProvider.KubaType});
        return kubaTasks.find(t => t.name === task);
    }
    private async getKubaTasks(): Promise<vscode.Task[]> {
        if (!vscode.workspace.rootPath) { return []; }
    
        const relativeTiltfilePath = wsCfg<string>("tilt.tiltfilePath") || "Tiltfile";

        let tiltDef: KubaTaskDefinition = {
            type: KubaTaskProvider.KubaType,
            label: KubaTaskProvider.TiltUp,
            command: 'tilt',
            args: ["up", "--file=" + path.join("${workspaceFolder}", relativeTiltfilePath), "--hud=false", "--debug=true", "|", "tee", `"${this.TiltOutFileFullName}"`]
        };
        let tiltExecution = new vscode.ShellExecution(tiltDef.command, tiltDef.args);
        let tiltUpTask = new vscode.Task(tiltDef, vscode.TaskScope.Workspace, tiltDef.label, 'Kuba', tiltExecution, ["$tilt"]);
    
        let relativeSrcDir = wsCfg<string>("build.srcDir") || "src";
        let relativeBuildOutputDir = wsCfg<string>("build.outputDir") || "dev/bin";
    
        let buildDef: KubaTaskDefinition = {
            type: KubaTaskProvider.KubaType,
            label: KubaTaskProvider.DotnetBuild,
            command: 'dotnet',
            args: [
                "build", path.join("${workspaceFolder}", relativeSrcDir), "/property:GenerateFullPaths=true", "/consoleloggerparameters:NoSummary",
                "--output", path.join("${workspaceFolder}", relativeBuildOutputDir)
            ]
        };
        
        let buildExecution = new vscode.ProcessExecution(buildDef.command, buildDef.args);
        let buildTask = new vscode.Task(buildDef, vscode.TaskScope.Workspace, buildDef.label, 'Kuba', buildExecution, ["$msCompile"]);
                                
        tiltUpTask.group = 'build';
        buildTask.group = 'build';
        return [tiltUpTask, buildTask];
    }  
}
