import * as vscode from 'vscode';

export interface QuickPickPlusOptions {
    step: number;
    placeholder: string;
    title: string;
    itemsSource: () => Promise<string[]>;
    autoPickOnSingleItem: boolean;
    autoSelectOnName: string | undefined;
}

export class QuickPickPlus {

    private pick: vscode.QuickPick<vscode.QuickPickItem>;
    private options: QuickPickPlusOptions;
    private context: vscode.ExtensionContext;
    constructor(pick: vscode.QuickPick<vscode.QuickPickItem>,
        options: QuickPickPlusOptions,
        context: vscode.ExtensionContext) {
        this.pick = pick;
        this.options = options;
        this.context = context;
    }

    public show() {
        var promise = new Promise<string | undefined>(async (resolve, reject) => {
            try {
                this.pick.show();
                this.pick.title = this.options.title;
                this.context.subscriptions.push(this.pick.onDidChangeSelection(selection => {
                    resolve(selection[0].label);
                    this.pick.items = [];
                    this.pick.busy = true;
                }));
                this.pick.placeholder = this.options.placeholder;
                this.pick.busy = true;
                this.pick.step = this.options.step;
                this.pick.items = (await this.options.itemsSource()).map(label => ({ label: label }));
                this.pick.placeholder = "";
                this.pick.busy = false;

                if (this.options.autoPickOnSingleItem && this.pick.items.length === 1) {
                    await this.autoSelect(this.pick.items[0]);
                }

                if (this.options.autoSelectOnName) {
                    let matchingItem = this.pick.items.find(x => x.label === this.options.autoSelectOnName);
                    if (matchingItem) {
                        await this.autoSelect(matchingItem);
                    }
                }
            }
            catch (error) {
                console.error(error);
                reject(undefined);
            }
        });
        return promise;
    }

    private async autoSelect(item: vscode.QuickPickItem) {
        this.pick.placeholder = "Auto-selecting ...";
        await new Promise(resolve => setTimeout(resolve, 200));
        this.pick.activeItems = [item];
        await new Promise(resolve => setTimeout(resolve, 500));
        this.pick.selectedItems = [item];
    }
}
