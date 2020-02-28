import { WorkspaceFolder, DebugConfiguration, CancellationToken } from 'vscode';
import * as vscode from 'vscode';

export class KubaConfigurationProvider implements vscode.DebugConfigurationProvider {

	private Context: vscode.ExtensionContext;
	constructor(context: vscode.ExtensionContext) {
		this.Context = context;
	}

	async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): Promise<vscode.DebugConfiguration | undefined> {

		if (config.name === '.NET Core Attach to K8s (Kuba)') {
					
			if (vscode.workspace.getConfiguration('kuba').get<boolean>("runTiltUpBeforeAttach"))
			{
				const kubaTasks = await vscode.tasks.fetchTasks({type:'kuba'});
				const tiltUp = kubaTasks.find(t => t.name === 'tilt-up');
				if (tiltUp && !vscode.tasks.taskExecutions.find(t => t.task.name === 'tilt-up')) 
				{ 
					await vscode.tasks.executeTask(tiltUp);
				}		
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