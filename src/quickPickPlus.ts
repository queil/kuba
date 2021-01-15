import * as vscode from 'vscode';

export interface QuickPickPlusOptions
{
    step: number;
    placeholder: string;
    title: string;
    itemsSource: () => Promise<string[]>;
    autoPickOnSingleItem: boolean;
    autoSelectOnName: string | undefined;
}

export class QuickPickPlus {

    private Pick: vscode.QuickPick<vscode.QuickPickItem>;
    private Options : QuickPickPlusOptions;
    private Context : vscode.ExtensionContext;
    constructor(pick:vscode.QuickPick<vscode.QuickPickItem>, 
                options: QuickPickPlusOptions,
                context:vscode.ExtensionContext)
    {
        this.Pick = pick;
        this.Options = options;
        this.Context = context;
    }

    public show() 
    {
        var promise = new Promise<string | undefined>(async (resolve, reject) => {
            try 
            {
                this.Pick.show();
                this.Pick.title = this.Options.title;
                this.Context.subscriptions.push(this.Pick.onDidChangeSelection(selection => {
                    resolve(selection[0].label); 
                    this.Pick.items = [];
                    this.Pick.busy = true;             
                }));
                this.Pick.placeholder = this.Options.placeholder;
                this.Pick.busy = true;
                this.Pick.step = this.Options.step;		
                this.Pick.items = (await this.Options.itemsSource()).map(label => ({ label: label }));
                this.Pick.placeholder = "";
                this.Pick.busy = false;

                if (this.Options.autoPickOnSingleItem && this.Pick.items.length === 1) {
                    await this.AutoSelect( this.Pick.items[0]);
                }

                if (this.Options.autoSelectOnName) {
                    let matchingItem = this.Pick.items.find(x => x.label === this.Options.autoSelectOnName);
                    if (matchingItem) {
                        await this.AutoSelect(matchingItem);
                    }
                }
            } 
            catch (error) 
            {
                console.error(error);
                reject(undefined);
            }
        });
        return promise;
    }

    private async AutoSelect( item: vscode.QuickPickItem) 
    {
        this.Pick.placeholder = "Auto-selecting ...";
        await new Promise( resolve => setTimeout(resolve, 200) );
        this.Pick.activeItems = [ item ];
        await new Promise( resolve => setTimeout(resolve, 500) );
        this.Pick.selectedItems = [ item ];
    }
}