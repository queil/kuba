import * as vscode from 'vscode';

export type KubaConfigKey = 
    // build section
    | 'build.srcDir' 
    | 'build.outputDir' 

    // docker section
    | 'docker.appTargetDir'
    | 'docker.appPort'
    | 'docker.defaultRegistry'
    | 'docker.debuggerImage'
    | 'docker.buildContextDir'

    // kubernetes
    | 'k8s.manifestsDir'
   
    //tilt section
    | 'tilt.tiltfilePath' 
    | 'tilt.allowedKubernetesContext'
    | 'tilt.upBeforeAttach' 
    | 'tilt.forwardPort'
    | 'tilt.appReadyRegEx'

    // debug section
    | 'debug.defaultRemoteProcessId'
    | 'debug.attachNamespace'
    | 'debug.attachKubernetesContext'

    // assets
    | 'assets.overwrite';

export type KubaStateKey = 'context' | 'namespace' | 'pod' | 'container' | 'tiltOutFile';

const CfgRoot = 'kuba';

export function wsCfg<T>(key: KubaConfigKey) {

    var value = vscode.workspace.getConfiguration(CfgRoot).get<T>(key);
    if (!value) {
        vscode.window.showErrorMessage(`No value set for the ${CfgRoot}.${key} setting.`);
        throw Error(`No value set for the ${CfgRoot}.${key} setting.`); 
    }
    return value;
}

export async function setWsCfg<T>(key: KubaConfigKey, value:T) {
    await vscode.workspace.getConfiguration(CfgRoot).update(key, value);
}

export class KubaWsState {

    private Context: vscode.ExtensionContext;
    constructor(context: vscode.ExtensionContext) {
        this.Context = context;
    }
    public get(key: KubaStateKey) 
    {
        return this.Context.workspaceState.get<string>(key);
    }

    public getT<T>(key: KubaStateKey) 
    {
        return this.Context.workspaceState.get<T>(key);
    }

    public async set<T>(key: KubaStateKey, value: T | undefined) 
    {
        await this.Context.workspaceState.update(key,value);
    }

    public async getWriteThrough<T>(key: KubaStateKey, getter: () => Promise<T|undefined>) 
	{
		let value = await getter(); 
		if (!value) {
			console.error(`Getter returned no value for key: ${key}`);
			return "";
		}
		
		await this.set(key, value); 
		return value;	
	}
}