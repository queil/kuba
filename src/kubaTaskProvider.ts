import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { wsCfg, KubaWsState } from './config';

const uniqueFilename = require('unique-filename');
const lazy = require('lazy');

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
	private WsState: KubaWsState;
	private TiltOutDirWatcher: fs.FSWatcher | undefined;
	private TiltOutDir : string = path.join(os.tmpdir(), "tilt");
	private TiltOutFileWatcher: fs.FSWatcher | undefined;
	private TiltOutFile : string = uniqueFilename(this.TiltOutDir, "tilt");
	
	constructor(context: KubaWsState)
	{
		this.WsState = context;
	}

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
			} catch (r) {
				console.log(r);
			}
			if (!this.TiltOutFile) { return; }

			 if (await this.assertTiltIsUp()) {

				await this.assertTiltIsForwarding();
				
			 }
		}	
	}

	private assertTiltIsForwarding()
	{
		return new Promise<string>((resolve,_) => {
		var tiltOutStream = fs.createReadStream(this.TiltOutFile);
		new lazy(tiltOutStream).lines.forEach((buffer:Buffer) => {

				const line = buffer.toString('utf8');
				const match = line.match(".*Forwarding from (\d+\.\d+\.\d+\.\d+:\d+) ->.*");
				
				if (match) {
					return resolve(match[1]);
				}
			});
		});
	}

	private async assertTiltIsUp()
	{
		var tiltStarted = new Promise<boolean>((resolve, _) => {
			
			this.TiltOutDirWatcher = fs.watch(this.TiltOutDir, (event, name) => {
				resolve(true);
			});
		});

		const timeout = new Promise<boolean>((resolve, _) => { setTimeout(() => resolve(false), wsCfg<number>('debug.tiltUpStartTimeoutMs')); });

		var result = await Promise.race([tiltStarted, timeout]);
		this.TiltOutDirWatcher?.close();
		return result;

	}

	public async onTiltExited() {
		
		if (this.TiltOutFileWatcher) {this.TiltOutFileWatcher.close();}
		if (this.TiltOutFile) {
			fs.unlink(this.TiltOutFile, (err) => {
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

	private fetchExecution(task:KubaTaskName)
	{
		return vscode.tasks.taskExecutions.find(t => t.task.definition.type === KubaTaskProvider.KubaType && t.task.name === task);
	}

	private async fetchTask(task: KubaTaskName)
	{
		const kubaTasks = await vscode.tasks.fetchTasks({type:KubaTaskProvider.KubaType});
		return kubaTasks.find(t => t.name === task);
	}
	private async getKubaTasks(): Promise<vscode.Task[]> {
		if (!vscode.workspace.rootPath) { return []; }
	
		const relativeTiltfilePath = wsCfg<string>("build.relativeTiltfilePath") || "Tiltfile";

		let tiltDef: KubaTaskDefinition = {
			type: KubaTaskProvider.KubaType,
			label: KubaTaskProvider.TiltUp,
			command: 'tilt',
			args: ["up", "--file=" + path.join("${workspaceFolder}", relativeTiltfilePath), "--hud=false", "--debug=true", "|", "tee", `"${this.TiltOutFile}"`]
		};
		let tiltExecution = new vscode.ShellExecution(tiltDef.command, tiltDef.args);
		let tiltUpTask = new vscode.Task(tiltDef, vscode.TaskScope.Workspace, tiltDef.label, 'Kuba', tiltExecution, ["$tilt"]);
	
		let relativeSrcDir = wsCfg<string>("build.relativeSrcDir") || "src";
		let relativeBuildOutputDir = wsCfg<string>("build.relativeBuildOutputDir") || "dev/bin";
	
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



