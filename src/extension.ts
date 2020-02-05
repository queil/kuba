import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	async function kubectl(argsString: string) {
		const util = require('util');
		const exec = util.promisify(require('child_process').exec);
		const { stdout, stderr } = await exec(`kubectl ${argsString}`);
		if (stderr) { vscode.window.showErrorMessage(stderr); }
		return stdout;
	}

	async function kubectlGet(argsString: string)
	{
		const stdout = await kubectl(`${argsString} -o name`);
		const items = stdout.trim().split("\n").flatMap((s:string) => s.split('/').slice(-1)[0]);
		return items;
	}

	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickPod', async () => {
		
		const config = vscode.workspace.getConfiguration('kuba');
		let namespace = config.get<string>("namespace");

		if (!namespace) {
			await vscode.commands.executeCommand('kuba.useNamespace');
			const config = vscode.workspace.getConfiguration('kuba');
		    namespace = config.get<string>("namespace");
		}

		if (namespace) {
			const selectedPod = await vscode.window.showQuickPick(kubectlGet(`get pod -n ${namespace}`), { placeHolder: `Getting pods in ${namespace}...` });
			await config.update("pod", selectedPod, vscode.ConfigurationTarget.Workspace);
		} else {
			vscode.window.showErrorMessage("Namespace not selected. Run 'Kube: Use Namespace' command");
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.useNamespace', async () => {
		
		const selectedNs = await vscode.window.showQuickPick(kubectlGet("get namespaces"), { placeHolder: 'Getting namespaces...' });

		const config = vscode.workspace.getConfiguration('kuba');
		await config.update("namespace", selectedNs, vscode.ConfigurationTarget.Workspace);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.useContext', async () => {
		
		const selectedContext = await vscode.window.showQuickPick(kubectlGet("config get-contexts"), { placeHolder: 'Getting contexts...' });

		const config = vscode.workspace.getConfiguration('kuba');
		await config.update("context", selectedContext, vscode.ConfigurationTarget.Workspace);
		kubectl(`config use-context ${selectedContext}`);
	}));
}

export function deactivate() {}