import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	async function kubectl(argsString: string) {
		const util = require('util');
		const exec = util.promisify(require('child_process').exec);
		
		const { stdout, stderr } = await exec('kubectl.exe' + ' ' + argsString + ' ' + '-o jsonpath="{.items[*].metadata.name}"');
		if (stderr) {
			vscode.window.showErrorMessage(stderr);
		}
		return stdout.split(" ");
	}


	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickPod', async () => {
		
		const config = vscode.workspace.getConfiguration('kuba');
		const namespace = config.get<string>("namespace");

		if (!namespace) {
			await vscode.commands.executeCommand('kuba.useNamespace');
		}

		const selectedPod = await vscode.window.showQuickPick(kubectl("get pod"), { placeHolder: 'Pick pod...' });

		config.update("pod", selectedPod);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.useNamespace', async () => {
		
		const selectedNs = await vscode.window.showQuickPick(kubectl("get namespaces"), { placeHolder: 'Pick namespace...' });

		const config = vscode.workspace.getConfiguration('kuba');
		config.update("namespace", selectedNs);
	}));

	
}

export function deactivate() {}