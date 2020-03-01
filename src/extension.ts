import * as vscode from 'vscode';
import { KubaTaskProvider } from './kubaTaskProvider';
import { KubaConfigurationProvider } from './kubaConfigurationProvider';
import { QuickPickPlus } from './quickPickPlus';
import { Kubectl } from './kubectl';
import { KubaWsState } from './config';
import { FSWatcher } from 'fs';

export function activate(context: vscode.ExtensionContext) {

	//////////////////////////////////////////////////////////////////////////////
	// 
	// Extension main code
	//
	//////////////////////////////////////////////////////////////////////////////

	let workspaceRoot = vscode.workspace.rootPath;
	if (!workspaceRoot) { return; }
	const wsState = new KubaWsState(context);
	const taskProvider = new KubaTaskProvider(wsState);
	const provider = new KubaConfigurationProvider(context, taskProvider);
	const kubectl = new Kubectl(stderr => vscode.window.showErrorMessage(stderr));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('coreclr', provider));
	context.subscriptions.push(vscode.tasks.registerTaskProvider(KubaTaskProvider.KubaType, taskProvider));

	context.subscriptions.push(vscode.tasks.onDidEndTask(async t => {

		const task = t.execution.task;
		if (task.definition.type !== KubaTaskProvider.KubaType) { return; }

		if (task.name === KubaTaskProvider.TiltUp) 
		{
			await taskProvider.onTiltExited();
		}

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

		const container = wsState.get('container');
		const pod = wsState.get('pod');
		const namespace = wsState.get('namespace');

		const isCacheValid = container && pod && namespace && (await kubectl.getContainersInPod(pod, namespace, true)).some(x => x === container);

		if (isCacheValid) {return;}

		const pick = vscode.window.createQuickPick();

		try {
			pick.totalSteps = 4;
			pick.ignoreFocusOut = true;	
			
			const placeholder = "Loading ...";

			await wsState.getWriteThrough('context', 
				() => new QuickPickPlus(pick, { 
					step: 1,
					title: "Pick Context",
					placeholder: placeholder, 
					itemsSource: () => kubectl.get("config get-contexts"),
					autoPickOnSingleItem: true
					},context).show());

			const namespace = 
				await wsState.getWriteThrough('namespace', 
					() => new QuickPickPlus(pick, { 
						step: 2,
						title: "Pick Namespace",
						placeholder: placeholder,
						itemsSource: () => kubectl.get("get namespaces"),
						autoPickOnSingleItem: true
					},context).show());

			const pod = 
				await wsState.getWriteThrough('pod', 
				    () => new QuickPickPlus(pick, { 
						step: 3,
						title: "Pick Pod",
						placeholder: placeholder,
						itemsSource: () => kubectl.get(`get pod -n ${namespace}`),
						autoPickOnSingleItem: true
					},context).show());

				await wsState.getWriteThrough('container',
					() => new QuickPickPlus(pick, { 
						step: 4,
						title: "Pick container",
						placeholder: placeholder,
						itemsSource: () => kubectl.getContainersInPod(pod, namespace, false),
						autoPickOnSingleItem: true
					},context).show());	
		} 
		finally 
		{
			pick.dispose();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.resetSelection', async () => {	
		await wsState.set("context", undefined);
	    await wsState.set("namespace", undefined);
		await wsState.set("pod", undefined);
		await wsState.set("container", undefined);
	}));
}

export function deactivate() {}
