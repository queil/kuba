import { WorkspaceFolder, DebugConfiguration, CancellationToken } from 'vscode';
import * as vscode from 'vscode';
import { KubaTaskProvider } from './kubaTaskProvider';
import { wsCfg } from './config';

export class KubaConfigurationProvider implements vscode.DebugConfigurationProvider {
	static ConfigName = '.NET Core Attach to K8s (Kuba)'; 
	private Context: vscode.ExtensionContext;
	private TaskProvider: KubaTaskProvider;
	constructor(context: vscode.ExtensionContext, taskProvider: KubaTaskProvider ) {
		this.Context = context;
		this.TaskProvider = taskProvider;
	}

	async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): Promise<vscode.DebugConfiguration | undefined> {

		if (config.name ===  KubaConfigurationProvider.ConfigName) {
					
			if (wsCfg<boolean>("runTiltUpBeforeAttach"))
			{
				await this.TaskProvider.runTiltUp();
			}

			await vscode.commands.executeCommand("kuba.attachTo");
			const wsState = this.Context.workspaceState;
			const ns = wsState.get<string>('namespace');
			const pod = wsState.get<string>('pod');
			const container = wsState.get<string>('container');

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
			
			config.processId = wsCfg<boolean>("useDefaultRemoteProcessId") ? wsCfg<number>("defaultRemoteProcessId") : "${command:pickProcess}" ;
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