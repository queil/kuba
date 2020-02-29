import * as vscode from 'vscode';

export function wsCfg<T>(key: string) {
    return vscode.workspace.getConfiguration('kuba').get<T>(key);
}
