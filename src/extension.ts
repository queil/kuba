import * as vscode from 'vscode';
import { KubaTaskProvider } from './kubaTaskProvider';
import { WorkspaceFolder, DebugConfiguration, CancellationToken } from 'vscode';

export class KubaCommandRunner {

	private Context: vscode.ExtensionContext;
	constructor(context: vscode.ExtensionContext) {
		this.Context = context;
	}

	async getFromStateOrCommand(settingName: string, commandName:string, errorMsg: string) 
	{
		let value = this.Context.workspaceState.get<string>(settingName);

		if (!value) {
			await vscode.commands.executeCommand(commandName);
			value = this.Context.workspaceState.get<string>(settingName);
		} 
		
		if (!value) {
			vscode.window.showErrorMessage(errorMsg);
			return "";
		}
		return value;	
	}

	async getOrPickContext() { return this.getFromStateOrCommand('context', 'kuba.pickContext', "Context not selected. Run 'Kuba: Pick Context' command"); }
	async getOrPickNamespace() { return this.getFromStateOrCommand('namespace', 'kuba.pickNamespace', "Namespace not selected. Run 'Kuba: Pick Namespace' command");	 }
	async getOrPickPod() { return this.getFromStateOrCommand('pod', 'kuba.pickPod', "Pod not selected. Run 'Kuba: Pick Pod' command"); }
	async getOrPickContainer() { return this.getFromStateOrCommand('container', 'kuba.pickContainer', "Container not selected. Run 'Kuba: Pick Container' command"); }
}
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

	async function updateState(key:string, value:string | undefined)
	{
		await context.workspaceState.update(key, value);
	}

	async function quickPickPlus(placeholder: string, getItems:Promise<string[]>)
	{
		return await new Promise<string | undefined>(async (resolve, reject) => {
			try 
			{
				const pick = vscode.window.createQuickPick();
				pick.placeholder = placeholder;
				
				pick.onDidHide(() => 
				{
					pick.dispose();
					resolve(undefined);
				});
				pick.onDidChangeSelection(selection => {
					
					pick.hide();
					resolve(selection[0].label);
				});
				pick.show();
				pick.busy = true;
				pick.items = (await getItems).map(label => ({ label }));
				pick.busy = false;
				if (pick.items.length === 1) {
					pick.selectedItems = [ pick.items[0] ];
				}
			} 
			catch (error) 
			{
				console.error(error);
				reject(undefined);
			}
		});
	}


	//////////////////////////////////////////////////////////////////////////////
	// 
	// Extension main code
	//
	//////////////////////////////////////////////////////////////////////////////

	let workspaceRoot = vscode.workspace.rootPath;
	if (!workspaceRoot) {
		return;
	}

	const runner = new KubaCommandRunner(context);
	const provider = new KubaConfigurationProvider(context, runner);
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('coreclr', provider));
	context.subscriptions.push(vscode.tasks.registerTaskProvider(KubaTaskProvider.KubaType, new KubaTaskProvider()));
	
	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickPod', async () => {
		
		const namespace = await runner.getOrPickNamespace();
		const item = await quickPickPlus(`Kuba: getting pods in ${namespace}...`, kubectlGet(`get pod -n ${namespace}`));
        await updateState("pod", item); 			
		
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickContainer', async () =>{
		
		const context = await runner.getOrPickContext();
		const maybeNewContext = await kubectl("config current-context");

		if (maybeNewContext !== context)
		{
			vscode.window.showInformationMessage(`Kubectl context changed externally. Updating to ${maybeNewContext}`);
			await updateState("context", maybeNewContext);
		}

		const namespace = await runner.getOrPickNamespace();
		const pod = await runner.getOrPickPod();

		const item = await quickPickPlus(`Kuba: getting containers in ${pod}...`, getContainersInPod(pod, namespace));
		await updateState("container", item); 
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickNamespace', async () => {
		
		const context = await runner.getOrPickContext();
		const item = await quickPickPlus(`Kuba: getting namespaces from ${context}...`, kubectlGet("get namespaces"));
		await updateState("namespace", item); 
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickContext', async () => {
		
		const item = await quickPickPlus('Kuba: getting contexts...', kubectlGet("config get-contexts"));
		await updateState("context", item); 
		kubectl(`config use-context ${item}`);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.resetSelection', async () => {	
		updateState("context", undefined);
		updateState("namespace", undefined);
		updateState("pod", undefined);
		updateState("container", undefined);
	}));
}

export function deactivate() {}

class KubaConfigurationProvider implements vscode.DebugConfigurationProvider {

	private Context: vscode.ExtensionContext;
	private Runner: KubaCommandRunner;
	constructor(context: vscode.ExtensionContext, runner: KubaCommandRunner) {
		this.Context = context;
		this.Runner = runner;
	}

	async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): Promise<vscode.DebugConfiguration | undefined> {

		if (config.name === '.NET Core Attach to K8s (Kuba)') {
									
			const container = await this.Runner.getOrPickContainer();
			const wsState = this.Context.workspaceState;
		    const pod = wsState.get<string>('pod');
			const ns = wsState.get<string>('namespace');		

			config.pipeTransport.pipeArgs = ['exec', '-i', pod, '-n', ns, '-c', container, '--'];
		}

		return config;
	}

	provideDebugConfigurations?(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]>
    {
        if (folder)
        {
			const config :DebugConfiguration = {
				'name' : '.NET Core Attach to K8s (Kuba)',
			    'type' : 'coreclr',
			    'request' : 'attach'
			};
			
			config.processId = "${command:pickRemoteProcess}";
			config.justMyCode = true; 
			config.pipeTransport = 
                {
					"pipeProgram": "kubectl",
					"pipeArgs": [],
					"pipeCwd": "${workspaceFolder}",
					"debuggerPath": "/root/vsdbg/vsdbg", 
					"quoteArgs": false
			    };
				
				config.sourceFileMap = 
				{
					"/src": "${workspaceFolder}/src",
					"/app": "${workspaceFolder}/src"
				};
			if (!config.pipeTransport.pipeProgram) {
				return vscode.window.showInformationMessage("kubectl not found. Is it installed? Is it in the PATH?").then(_ => {
					return undefined;	// abort launch
				});
			}
			return [config];
        } else {
            return [];
        }          
    }
}

