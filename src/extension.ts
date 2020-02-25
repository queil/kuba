import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';

async function getFromConfigOrCommand(settingName: string, commandName:string, errorMsg: string) 
{
	const config = vscode.workspace.getConfiguration('kuba');
	let value = config.get<string>(settingName);

	if (!value) {
		await vscode.commands.executeCommand(commandName);
		const config = vscode.workspace.getConfiguration('kuba');
		value = config.get<string>(settingName);
	} 
	 
	if (!value) {
		vscode.window.showErrorMessage(errorMsg);
		return "";
	}
	return value;	
}

async function getOrPickContext() { return getFromConfigOrCommand('context', 'kuba.pickContext', "Context not selected. Run 'Kuba: Pick Context' command"); }
async function getOrPickNamespace() { return getFromConfigOrCommand('namespace', 'kuba.pickNamespace', "Namespace not selected. Run 'Kuba: Pick Namespace' command");	 }
async function getOrPickPod() { return getFromConfigOrCommand('pod', 'kuba.pickPod', "Pod not selected. Run 'Kuba: Pick Pod' command"); }
async function getOrPickContainer() { return getFromConfigOrCommand('container', 'kuba.pickContainer', "Container not selected. Run 'Kuba: Pick Container' command"); }

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

	async function updateConfig(key:string, value:string | undefined)
	{
		const config = vscode.workspace.getConfiguration('kuba');
		await config.update(key, value, vscode.ConfigurationTarget.Workspace);
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
	const provider = new KubaConfigurationProvider();

	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('coreclr', provider));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickPod', async () => {
		
		const namespace = await getOrPickNamespace();
		const item = await quickPickPlus(`Kuba: getting pods in ${namespace}...`, kubectlGet(`get pod -n ${namespace}`));
        await updateConfig("pod", item); 			
		
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickContainer', async () =>{
		
		const context = await getOrPickContext();
		const maybeNewContext = await kubectl("config current-context");

		if (maybeNewContext !== context)
		{
			vscode.window.showInformationMessage(`Kubectl context changed externally. Updating to ${maybeNewContext}`);
			await updateConfig("context", maybeNewContext);
		}

		const namespace = await getOrPickNamespace();
		const pod = await getOrPickPod();

		const item = await quickPickPlus(`Kuba: getting containers in ${pod}...`, getContainersInPod(pod, namespace));
		await updateConfig("container", item); 
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickNamespace', async () => {
		
		const context = await getOrPickContext();
		const item = await quickPickPlus(`Kuba: getting namespaces from ${context}...`, kubectlGet("get namespaces"));
		await updateConfig("namespace", item); 
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.pickContext', async () => {
		
		const item = await quickPickPlus('Kuba: getting contexts...', kubectlGet("config get-contexts"));
		await updateConfig("context", item); 
		kubectl(`config use-context ${item}`);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('kuba.resetConfig', async () => {	
		updateConfig("context", undefined);
		updateConfig("namespace", undefined);
		updateConfig("pod", undefined);
		updateConfig("container", undefined);
	}));
}

export function deactivate() {}

class KubaConfigurationProvider implements vscode.DebugConfigurationProvider {

	async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): Promise<vscode.DebugConfiguration | undefined> {

		if (config.name === '.NET Core Attach to K8s (Kuba)') {
									
			const container = await getOrPickContainer();
			const wsConfig = vscode.workspace.getConfiguration('kuba');
		    const pod = wsConfig.get<string>('pod');
			const ns = wsConfig.get<string>('namespace');		

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