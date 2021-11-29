import * as vscode from 'vscode';
import { KubaTaskProvider } from './kubaTaskProvider';
import { KubaConfigurationProvider } from './kubaConfigurationProvider';
import { QuickPickPlus } from './quickPickPlus';
import { Kubectl } from './kubectl';
import { KubaWsState, setWsCfg, wsCfg } from './config';
import * as path from 'path';
import { InputBoxPlus } from './inputBoxPlus';
import { generateAssets } from './assetsGenerator';

export function activate(context: vscode.ExtensionContext) {

  //////////////////////////////////////////////////////////////////////////////
  //
  // Extension main code
  //
  //////////////////////////////////////////////////////////////////////////////

  if (!vscode.workspace.workspaceFolders) { return; }
  const channel = vscode.window.createOutputChannel("Kuba");
  const wsState = new KubaWsState(context);
  const taskProvider = new KubaTaskProvider(channel);
  const provider = new KubaConfigurationProvider(context, taskProvider);
  const kubectl = new Kubectl(stderr => vscode.window.showErrorMessage(stderr));
  context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('coreclr', provider));
  context.subscriptions.push(vscode.tasks.registerTaskProvider(KubaTaskProvider.KubaType, taskProvider));

  context.subscriptions.push(vscode.tasks.onDidEndTask(async t => {

    const task = t.execution.task;
    if (task.definition.type !== KubaTaskProvider.KubaType) { return; }

    if (task.name === KubaTaskProvider.TiltUp) { await taskProvider.onTiltExited(); }

    if (vscode.debug.activeDebugSession && task.name === KubaTaskProvider.DotnetBuild && taskProvider.isTaskRunning('tilt-up'))
    {
      const timeout = new Promise<boolean>((resolve, _) => { setTimeout(() => resolve(false), 10000); });
      const debugSessionTerminated = new Promise<boolean>(async (resolve, _) => {

        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(s => {
          resolve(s.configuration.name === KubaConfigurationProvider.ConfigName);
        }));
      });
      taskProvider.focusOn('tilt-up');
      const shouldReattach = await Promise.race([timeout, debugSessionTerminated]);
      if (shouldReattach) { await vscode.commands.executeCommand('workbench.action.debug.start'); }
    }
  }));


  context.subscriptions.push(vscode.commands.registerCommand('kuba.init', async () => {

    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showErrorMessage("No folders found. Load a workspace first");
      return;
    }

    const inputBox = vscode.window.createInputBox();
    inputBox.totalSteps = 7;
    inputBox.ignoreFocusOut = true;

        const wsRoot = vscode.workspace.workspaceFolders[0].uri;
        const pickRelativeFolder = async () => {
            var uris = await vscode.window.showOpenDialog({ defaultUri: wsRoot, canSelectFiles:false, canSelectFolders:true, canSelectMany: false});
            if (!uris) { throw new Error("Folder not selected!"); }
            return path.relative(wsRoot.fsPath, uris[0].fsPath);
        };

        const browseButton = { iconPath: vscode.ThemeIcon.Folder, tooltip: "Browse", getValue: pickRelativeFolder };

        try {

            await vscode.commands.executeCommand('kuba.resetSelection');
            let step = 1;

            await setWsCfg('build.srcDir',
                await new InputBoxPlus(inputBox, {
                    step: step++,
                    title: "Configure: Source code dir",
                    defaultValue: wsCfg<string>('build.srcDir'),
                    buttons: [browseButton]
                },context).show());

            await setWsCfg('build.outputDir',
                await new InputBoxPlus(inputBox, {
                    step: step++,
                    title: "Configure: Build output dir",
                    defaultValue: wsCfg<string>('build.outputDir'),
                    buttons: [browseButton]
                },context).show());

      await setWsCfg('docker.appPort',
                await new InputBoxPlus(inputBox, {
                    step: step++,
                    title: "Configure: Application port",
                    defaultValue: wsCfg<string>('docker.appPort'),
                    buttons: []
        },context).show());

            await setWsCfg('docker.buildContextDir',
                await new InputBoxPlus(inputBox, {
                    step: step++,
                    title: "Configure: Docker build context dir",
                    defaultValue: wsCfg<string>('docker.buildContextDir'),
                    buttons: [browseButton]
                },context).show());

            await setWsCfg('tilt.tiltfilePath',
                await new InputBoxPlus(inputBox, {
                    step: step++,
                    title: "Configure: Tiltfile path",
                    defaultValue: wsCfg<string>('tilt.tiltfilePath'),
                    buttons: [browseButton]
        },context).show());

      await setWsCfg('assets.overwrite',
                await new InputBoxPlus(inputBox, {
                    step: step++,
                    title: "Configure: Overwrite assets?",
          defaultValue:  wsCfg<string>('assets.overwrite'),
          buttons : []
                },context).show());

            await generateAssets();
    }
    catch (err)
    {
      vscode.window.showErrorMessage((err as Error).message);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('kuba.attachTo', async () => {

    const container = wsState.get('container');
    const pod = wsState.get('pod');
    const namespace = wsState.get('namespace');

    const isCacheValid = container && pod && namespace && (await kubectl.getContainersInPod(pod, namespace, true)).some(x => x === container);

    if (isCacheValid) {return;}

    const pick = vscode.window.createQuickPick();

    try {
      pick.totalSteps = 4;
      pick.ignoreFocusOut = true;

      const placeholder = "Loading ...";

      await wsState.getWriteThrough('context',
        () => new QuickPickPlus(pick, {
          step: 1,
          title: "Pick Context",
          placeholder: placeholder,
          itemsSource: () => kubectl.get("config get-contexts"),
          autoPickOnSingleItem: true,
          autoSelectOnName: wsCfg<string>("debug.attachKubernetesContext")
          },context).show());

      const namespace =
        await wsState.getWriteThrough('namespace',
          () => new QuickPickPlus(pick, {
            step: 2,
            title: "Pick Namespace",
            placeholder: placeholder,
            itemsSource: () => kubectl.get("get namespaces"),
            autoPickOnSingleItem: true,
            autoSelectOnName: wsCfg<string>("debug.attachNamespace")
          },context).show());

      const pod =
        await wsState.getWriteThrough('pod',
            () => new QuickPickPlus(pick, {
            step: 3,
            title: "Pick Pod",
            placeholder: placeholder,
            itemsSource: () => kubectl.get(`get pod -n ${namespace}`),
            autoPickOnSingleItem: true,
            autoSelectOnName: undefined
          },context).show());

        await wsState.getWriteThrough('container',
          () => new QuickPickPlus(pick, {
            step: 4,
            title: "Pick container",
            placeholder: placeholder,
            itemsSource: () => kubectl.getContainersInPod(pod, namespace, false),
            autoPickOnSingleItem: true,
            autoSelectOnName: undefined
          },context).show());
    }
    finally
    {
      pick.dispose();
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('kuba.resetSelection', async () => {
    await wsState.set("context", undefined);
      await wsState.set("namespace", undefined);
    await wsState.set("pod", undefined);
    await wsState.set("container", undefined);
  }));
}

export function deactivate() {}
