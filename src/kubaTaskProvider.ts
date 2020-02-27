import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface KubaTaskDefinition extends vscode.TaskDefinition {
	
	label: string;
	command: string;
	args: string[];
}

export class KubaTaskProvider implements vscode.TaskProvider {
	static KubaType: string = 'kuba';
	private Promise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor(workspaceRoot: string) {
		let pattern = path.join(workspaceRoot, 'Tiltfile');
		let fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		fileWatcher.onDidChange(() => this.Promise = undefined);
		fileWatcher.onDidCreate(() => this.Promise = undefined);
		fileWatcher.onDidDelete(() => this.Promise = undefined);
	}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.Promise) {
			this.Promise = getKubaTasks();
		}
		return this.Promise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		return undefined;
	}
}

function exists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}

async function getKubaTasks(): Promise<vscode.Task[]> {
	let workspaceRoot = vscode.workspace.rootPath;
	let emptyTasks: vscode.Task[] = [];
	if (!workspaceRoot) {
		return emptyTasks;
	}
	let tiltFile = path.join(workspaceRoot, 'Tiltfile');
	if (!await exists(tiltFile)) {
		return emptyTasks;
	}
	let tiltDef: KubaTaskDefinition = {
		type: KubaTaskProvider.KubaType,
		label: 'tilt-up',
		command: 'tilt',
		args: ["up", "--file=${workspaceFolder}/Tiltfile", "--hud=false", "--debug=true"]
	};
	let tiltExecution = new vscode.ProcessExecution(tiltDef.command, tiltDef.args);
	let tiltUpTask = new vscode.Task(tiltDef, vscode.TaskScope.Workspace, 'Tilt Up', 'Kuba', tiltExecution, ["$tilt"]);

	let buildDef: KubaTaskDefinition = {
		type: KubaTaskProvider.KubaType,
		label: 'dotnet-build',
		command: 'dotnet',
		args: [
			"build", "${workspaceFolder}/src", "/property:GenerateFullPaths=true", "/consoleloggerparameters:NoSummary",
			"--output", "${workspaceFolder}/dev/bin"
		]
	};
	
	let buildExecution = new vscode.ProcessExecution(buildDef.command, buildDef.args);
	let buildTask = new vscode.Task(buildDef, vscode.TaskScope.Workspace, 'Dotnet Build', 'Kuba', buildExecution, ["$msCompile"]);
							
	tiltUpTask.group = 'build';
	buildTask.group = 'build';
	return [tiltUpTask, buildTask];
}
