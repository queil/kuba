import * as vscode from 'vscode';


export interface InputButtonPlus extends vscode.QuickInputButton {
    getValue: () => Promise<string>;
}

export interface InputBoxPlusOptions {
    step: number;
    defaultValue: string;
    title: string;
    buttons: InputButtonPlus[];
}

export class InputBoxPlus {

    private box: vscode.InputBox;
    private options: InputBoxPlusOptions;
    private context: vscode.ExtensionContext;
    constructor(box: vscode.InputBox,
        options: InputBoxPlusOptions,
        context: vscode.ExtensionContext) {
        this.box = box;
        this.options = options;
        this.context = context;
    }

    public show() {
        var promise = new Promise<string>(async (resolve, reject) => {
            try {
                this.box.show();
                this.box.title = this.options.title;
                this.box.value = this.options.defaultValue;
                this.box.step = this.options.step;
                this.box.buttons = this.options.buttons;

                this.context.subscriptions.push(this.box.onDidAccept(() => {
                    resolve(this.box.value);
                    this.box.hide();
                }));

                this.options.buttons.forEach(b => {
                    this.context.subscriptions.push(
                        this.box.onDidTriggerButton(async qb => {
                            if (qb === b) {

                                this.box.value = await b.getValue();
                                this.box.show();
                            }
                        })
                    );
                });
            }
            catch (error) {
                console.error(error);
                reject("Error");
            }
        });
        return promise;
    }
}
