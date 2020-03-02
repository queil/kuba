import * as vscode from 'vscode';


export interface InputButtonPlus extends vscode.QuickInputButton {
    getValue: () => Promise<string>;
}

export interface InputBoxPlusOptions
{
    step: number;
    defaultValue: string;
    title: string;
    buttons: InputButtonPlus[];
}

export class InputBoxPlus {

    private Box: vscode.InputBox;
    private Options : InputBoxPlusOptions;
    private Context : vscode.ExtensionContext;
    constructor(box:vscode.InputBox, 
                options: InputBoxPlusOptions,
                context:vscode.ExtensionContext)
    {
        this.Box = box;
        this.Options = options;
        this.Context = context;
    }

    public show() 
    {
        var promise = new Promise<string>(async (resolve, reject) => {
            try 
            {
                this.Box.show();
                this.Box.title = this.Options.title;
                this.Box.value = this.Options.defaultValue;
                this.Box.step = this.Options.step;
                this.Box.buttons = this.Options.buttons;

                this.Context.subscriptions.push(this.Box.onDidAccept(() => {
                      resolve(this.Box.value); 
                      this.Box.hide();
                }));

                this.Options.buttons.forEach(b => { 
                    this.Context.subscriptions.push(
                        this.Box.onDidTriggerButton(async qb => {
                            if (qb === b) {    
                                
                                this.Box.value = await b.getValue();
                                this.Box.show();
                            }
                        })
                    );
                });
            } 
            catch (error) 
            {
                console.error(error);
                reject("Error");
            }
        });
        return promise;
    }
}