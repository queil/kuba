import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface TiltTaskDefinition extends vscode.TaskDefinition {
	
	task: string;
}

export class TiltTaskProvider implements vscode.TaskProvider {
	static TiltType: string = 'tilt';
	private TiltPromise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor(workspaceRoot: string) {
		let pattern = path.join(workspaceRoot, 'Tiltfile');
		let fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		fileWatcher.onDidChange(() => this.TiltPromise = undefined);
		fileWatcher.onDidCreate(() => this.TiltPromise = undefined);
		fileWatcher.onDidDelete(() => this.TiltPromise = undefined);
	}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.TiltPromise) {
			this.TiltPromise = getTiltTasks();
		}
		return this.TiltPromise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const task = _task.definition.task;
		
		if (task) {
            const definition: TiltTaskDefinition = <any>_task.definition;
			return new vscode.Task(
                    definition, 
                    definition.task, 
                    'tilt', 
                    new vscode.ShellExecution(`tilt ${definition.task}`));
		}
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

async function getTiltTasks(): Promise<vscode.Task[]> {
	let workspaceRoot = vscode.workspace.rootPath;
	let emptyTasks: vscode.Task[] = [];
	if (!workspaceRoot) {
		return emptyTasks;
	}
	let tiltFile = path.join(workspaceRoot, 'Tiltfile');
	if (!await exists(tiltFile)) {
		return emptyTasks;
	}
	let result: vscode.Task[] = [];

	let taskName = 'up';
	let kind: TiltTaskDefinition = {
		type: 'tilt',
        task: taskName,
	};
	let task = new vscode.Task(
                            kind, 
                            'tilt up',
                            'tilt', 
                            new vscode.ShellExecution(`tilt ${taskName} --file ${tiltFile} --hud=false --debug=true`),
                            ["$tilt"]);
	task.group = 'build';
	result.push(task);
	return result;
}
