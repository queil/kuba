import * as vscode from 'vscode';

export type KubaConfigKey = 'build.relativeSrcDir' | 'build.relativeBuildOutputDir' | 'build.relativeTiltfilePath' |
                            'debug.runTiltUpBeforeAttach' | 'debug.defaultRemoteProcessId';

export function wsCfg<T>(key: KubaConfigKey) {
    return vscode.workspace.getConfiguration('kuba').get<T>(key);
}
