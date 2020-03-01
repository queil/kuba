import * as vscode from 'vscode';

export type KubaConfigKey = 'relativeSrcDir' | 'relativeBuildOutputDir' | 'relativeTiltfilePath' |
                            'runTiltUpBeforeAttach' | 'defaultRemoteProcessId';

export function wsCfg<T>(key: KubaConfigKey) {
    return vscode.workspace.getConfiguration('kuba').get<T>(key);
}
