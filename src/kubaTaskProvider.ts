import * as vscode from 'vscode';
import * as path from 'path';

interface KubaTaskDefinition extends vscode.TaskDefinition {
	
	label: string;
	command: string;
	args: string[];
}

export class KubaTaskProvider implements vscode.TaskProvider {
	static KubaType: string = 'kuba';
	public provideTasks(): Thenable<vscode.Task[]> | undefined { return getKubaTasks(); }
	public resolveTask(_task: vscode.Task): vscode.Task | undefined { return undefined; }
}

async function getKubaTasks(): Promise<vscode.Task[]> {
	if (!vscode.workspace.rootPath) { return []; }

	const kubaConfig = vscode.workspace.getConfiguration("kuba");
	const relativeTiltfilePath = kubaConfig.get<string>("relativeTiltfilePath") || "Tiltfile";
	
	let tiltDef: KubaTaskDefinition = {
		type: KubaTaskProvider.KubaType,
		label: 'tilt-up',
		command: 'tilt',
		args: ["up", "--file=" + path.join("${workspaceFolder}", relativeTiltfilePath), "--hud=false", "--debug=true"]
	};
	let tiltExecution = new vscode.ProcessExecution(tiltDef.command, tiltDef.args);
	let tiltUpTask = new vscode.Task(tiltDef, vscode.TaskScope.Workspace, tiltDef.label, 'Kuba', tiltExecution, ["$tilt"]);

	let relativeSrcDir = kubaConfig.get<string>("relativeSrcDir") || "src";
	let relativeBuildOutputDir = kubaConfig.get<string>("relativeBuildOutputDir") || "dev/bin";

	let buildDef: KubaTaskDefinition = {
		type: KubaTaskProvider.KubaType,
		label: 'dotnet-build',
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
