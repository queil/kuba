import { WorkspaceFolder, DebugConfiguration, CancellationToken } from 'vscode';
import * as vscode from 'vscode';
import * as path from 'path';
import { KubaTaskProvider } from './kubaTaskProvider';
import { wsCfg } from './config';

export class KubaConfigurationProvider implements vscode.DebugConfigurationProvider {
  static configName = '.NET Core Attach to K8s (Kuba)';
  private context: vscode.ExtensionContext;
  private taskProvider: KubaTaskProvider;
  constructor(context: vscode.ExtensionContext, taskProvider: KubaTaskProvider) {
    this.context = context;
    this.taskProvider = taskProvider;
  }

  async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): Promise<vscode.DebugConfiguration | undefined> {

    if (config.name === KubaConfigurationProvider.configName) {

      if (wsCfg<boolean>("tilt.upBeforeAttach")) {
        await this.taskProvider.runTiltUp();
      }

      await vscode.commands.executeCommand("kuba.attachTo");
      const wsState = this.context.workspaceState;
      const ns = wsState.get<string>('namespace');
      const pod = wsState.get<string>('pod');
      const container = wsState.get<string>('container');

      config.pipeTransport.pipeArgs = ['exec', '-i', pod, '-n', ns, '-c', container, '--'];
    }

    return config;
  }

  provideDebugConfigurations?(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    if (folder) {
      const config: DebugConfiguration = {
        'name': '.NET Core Attach to K8s (Kuba)',
        'type': 'coreclr',
        'request': 'attach'
      };

      const defaultProcessId = wsCfg<number>("debug.defaultRemoteProcessId");
      config.processId = defaultProcessId && defaultProcessId > 0 ? defaultProcessId : "${command:pickProcess}";
      config.justMyCode = true;
      config.pipeTransport =
      {
        "pipeProgram": "kubectl",
        "pipeArgs": [],
        "pipeCwd": "${workspaceFolder}",
        "debuggerPath": "/root/vsdbg/vsdbg",
        "quoteArgs": false
      };

      const appTargetPath = wsCfg<string>('docker.appTargetDir');
      const srcPath = wsCfg<string>('build.srcDir');

      config.sourceFileMap = {};
      config.sourceFileMap[appTargetPath] = path.join("${workspaceFolder}", srcPath);

      if (!config.pipeTransport.pipeProgram) {
        return vscode.window.showInformationMessage("kubectl not found. Is it installed? Is it in the PATH?").then(_ => {
          return undefined;
        });
      }
      return [config];
    } else {
      return [];
    }
  }
}
