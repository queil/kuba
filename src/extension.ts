import * as vscode from 'vscode';
import { KubaTaskProvider } from './kubaTaskProvider';

import { quickPickPlus } from './quickPickPlus';
import { KubaConfigurationProvider } from './kubaConfigurationProvider';

export function activate(context: vscode.ExtensionContext) {

	async function kubectl(argsString: string):Promise<string> {
		const util = require('util');
		const exec = util.promisify(require('child_process').exec);
		const { stdout, stderr } = await exec(`kubectl ${argsString}`);
		if (stderr) { 
			vscode.window.showErrorMessage(stderr); 
			return "Error";
		}
		return stdout.trim();
	}

	async function kubectlGet(argsString: string)
	{
		const stdout = await kubectl(`${argsString} -o name`);
		const items = stdout.split("\n").flatMap((s:string) => s.split('/').slice(-1)[0]);
		return items;
	}

	async function getContainersInPod(pod:string, ns: string)
	{
		const stdout = await kubectl(`get pod ${pod} -n ${ns} -o jsonpath="{.spec.containers[*].name}"`);
		return stdout.split("\n");
	}

	async function update(key:string, value:string | undefined)
	{
		await context.workspaceState.update(key, value);
	}

	function get(key:string)
	{
		return context.workspaceState.get<string>(key);
	}

	async function getResource(key: string, getter: () => Promise<string|undefined>) 
	{
		let value = get(key);
		if (!value) { value = await getter(); } 
		if (!value) {
			console.error(`Could not get Kubernetes ${key}`);
			return "";
		}
		
		await update(key, value); 
		return value;	
	}

	//////////////////////////////////////////////////////////////////////////////
	// 
	// Extension main code
	//
	//////////////////////////////////////////////////////////////////////////////

	let workspaceRoot = vscode.workspace.rootPath;
	if (!workspaceRoot) { return; }

	const provider = new KubaConfigurationProvider(context);
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('coreclr', provider));
	context.subscriptions.push(vscode.tasks.registerTaskProvider(KubaTaskProvider.KubaType, new KubaTaskProvider()));
	context.subscriptions.push(vscode.commands.registerCommand('kuba.attachTo', async () => {

		const container = get("container");
		const pod = get("pod");
		const namespace = get("namespace");

		const invalidateCache = container && pod && namespace ? !(await getContainersInPod(pod, namespace)).includes(container) : true; 
		if (!invalidateCache) { return; }
		
		const pick = vscode.window.createQuickPick();

		try {
			pick.totalSteps = 4;
			pick.ignoreFocusOut = true;	
			
			const placeholder = "Loading ...";

			await getResource("context", 
				() => quickPickPlus(pick, { 
					step: 1,
					title: "Pick Context",
					placeholder: placeholder, 
					itemsSource: () => kubectlGet("config get-contexts"),
					autoPickOnSingleItem: true
					}));

			const namespace = 
				await getResource("namespace", 
					() => quickPickPlus(pick, { 
						step: 2,
						title: "Pick Namespace",
						placeholder: placeholder,
						itemsSource: () => kubectlGet("get namespaces"),
						autoPickOnSingleItem: true
					}));

			const pod = 
				await getResource("pod", 
				    () => quickPickPlus(pick, { 
						step: 3,
						title: "Pick Pod",
						placeholder: placeholder,
						itemsSource: () => kubectlGet(`get pod -n ${namespace}`),
						autoPickOnSingleItem: true
					}));

				await getResource("container",
					() => quickPickPlus(pick, { 
						step: 4,
						title: "Pick container",
						placeholder: placeholder,
						itemsSource: () => getContainersInPod(pod, namespace),
						autoPickOnSingleItem: true
					}));	
		} 
		finally 
		{
			pick.dispose();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.resetSelection', async () => {	
		update("context", undefined);
		update("namespace", undefined);
		update("pod", undefined);
		update("container", undefined);
	}));
}

export function deactivate() {}
