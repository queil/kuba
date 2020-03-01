import * as vscode from 'vscode';
import * as path from 'path';
import { wsCfg } from './config';

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
	public provideTasks(): Thenable<vscode.Task[]> | undefined { return this.getKubaTasks(); }
	public resolveTask(_task: vscode.Task): vscode.Task | undefined { return undefined; }
	public async runTiltUp()
	{
		const task:KubaTaskName = 'tilt-up';
		const tiltUp = await this.fetchTask(task);
		if (tiltUp && !this.isTaskRunning(task)) 
		{ 
			await vscode.tasks.executeTask(tiltUp);
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
			args: ["up", "--file=" + path.join("${workspaceFolder}", relativeTiltfilePath), "--hud=false", "--debug=true"]
		};
		let tiltExecution = new vscode.ProcessExecution(tiltDef.command, tiltDef.args);
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



