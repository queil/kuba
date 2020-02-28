import * as vscode from 'vscode';

export interface QuickPickPlusOptions
{
    step: number;
    placeholder: string;
    title: string;
    itemsSource: () => Promise<string[]>;
    autoPickOnSingleItem: boolean;
}

export async function quickPickPlus(pick:vscode.QuickPick<vscode.QuickPickItem>, options: QuickPickPlusOptions)
{
    let handle = new vscode.Disposable(() => {  

    });

    var promise = await new Promise<string | undefined>(async (resolve, reject) => {
        try 
        {
            pick.show();
            pick.title = options.title;
            handle = pick.onDidChangeSelection(selection => {
                resolve(selection[0].label);
                pick.items = [];
                pick.busy = true;
            });
            pick.placeholder = options.placeholder;
            pick.busy = true;
            pick.step = options.step;		
            pick.items = (await options.itemsSource()).map(label => ({ label: label }));
            pick.placeholder = "";
            pick.busy = false;

            if (options.autoPickOnSingleItem && pick.items.length === 1) {
                pick.placeholder = "Auto-selecting ...";
                await new Promise( resolve => setTimeout(resolve, 1000) );
            	pick.selectedItems = [ pick.items[0] ];
            }
        } 
        catch (error) 
        {
            console.error(error);
            reject(undefined);
        }
    });

    handle.dispose();
    return promise;
}