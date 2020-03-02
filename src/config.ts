import * as vscode from 'vscode';

export type KubaConfigKey = 'build.relativeSrcDir' | 'build.relativeBuildOutputDir' | 'build.relativeTiltfilePath' |
                            'debug.runTiltUpBeforeAttach' | 'debug.defaultRemoteProcessId';

export type KubaStateKey = 'context' | 'namespace' | 'pod' | 'container' | 'tiltOutFile';

export function wsCfg<T>(key: KubaConfigKey) {
    const cfgRoot = 'kuba';
    var value = vscode.workspace.getConfiguration(cfgRoot).get<T>(key);
    if (!value) {
        vscode.window.showErrorMessage(`No value set for the ${cfgRoot}.${key} setting.`);
        throw Error(`No value set for the ${cfgRoot}.${key} setting.`); 
    }
    return value;
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