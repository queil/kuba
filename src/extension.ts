import * as vscode from 'vscode';
import { KubaTaskProvider } from './kubaTaskProvider';
import { KubaConfigurationProvider } from './kubaConfigurationProvider';
import { QuickPickPlus } from './quickPickPlus';

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

	async function getContainersInPod(pod:string, ns: string, ignoreNotFound:boolean)
	{
		const stdout = await kubectl(`get pod ${pod} -n ${ns} ${ignoreNotFound ? "--ignore-not-found" : ""} -o jsonpath="{.spec.containers[*].name}"`);
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
		let value = await getter(); 
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
	const taskProvider = new KubaTaskProvider();
	const provider = new KubaConfigurationProvider(context, taskProvider);
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('coreclr', provider));
	context.subscriptions.push(vscode.tasks.registerTaskProvider(KubaTaskProvider.KubaType, taskProvider));

	context.subscriptions.push(vscode.tasks.onDidEndTask(async t => {

		const task = t.execution.task;
		if (task.definition.type !== KubaTaskProvider.KubaType) { return; }
		if (vscode.debug.activeDebugSession && task.name === KubaTaskProvider.DotnetBuild && taskProvider.isTaskRunning('tilt-up'))
		{
			const timeout = new Promise<boolean>((resolve, _) => { setTimeout(() => resolve(false), 10000); });
			const debugSessionTerminated = new Promise<boolean>(async (resolve, _) => {

				context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(s => {
					resolve(s.configuration.name === KubaConfigurationProvider.ConfigName);
				}));
			});
			taskProvider.focusOn('tilt-up');
			const shouldReattach = await Promise.race([timeout, debugSessionTerminated]);
			if (shouldReattach) { await vscode.commands.executeCommand('workbench.action.debug.start'); }
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.attachTo', async () => {

		const container = get("container");
		const pod = get("pod");
		const namespace = get("namespace");

		const isCacheValid = container && pod && namespace && (await getContainersInPod(pod, namespace, true)).some(x => x === container);

		if (isCacheValid) {return;}

		const pick = vscode.window.createQuickPick();

		try {
			pick.totalSteps = 4;
			pick.ignoreFocusOut = true;	
			
			const placeholder = "Loading ...";

			await getResource("context", 
				() => new QuickPickPlus(pick, { 
					step: 1,
					title: "Pick Context",
					placeholder: placeholder, 
					itemsSource: () => kubectlGet("config get-contexts"),
					autoPickOnSingleItem: true
					},context).show());

			const namespace = 
				await getResource("namespace", 
					() => new QuickPickPlus(pick, { 
						step: 2,
						title: "Pick Namespace",
						placeholder: placeholder,
						itemsSource: () => kubectlGet("get namespaces"),
						autoPickOnSingleItem: true
					},context).show());

			const pod = 
				await getResource("pod", 
				    () => new QuickPickPlus(pick, { 
						step: 3,
						title: "Pick Pod",
						placeholder: placeholder,
						itemsSource: () => kubectlGet(`get pod -n ${namespace}`),
						autoPickOnSingleItem: true
					},context).show());

				await getResource("container",
					() => new QuickPickPlus(pick, { 
						step: 4,
						title: "Pick container",
						placeholder: placeholder,
						itemsSource: () => getContainersInPod(pod, namespace, false),
						autoPickOnSingleItem: true
					},context).show());	
		} 
		finally 
		{
			pick.dispose();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.resetSelection', async () => {	
		await update("context", undefined);
	    await update("namespace", undefined);
		await update("pod", undefined);
		await update("container", undefined);
	}));
}

export function deactivate() {}
