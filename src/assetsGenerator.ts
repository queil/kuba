import { wsCfg } from "./config";
import * as fs from "fs";
import * as path from "path";
import * as vscode from 'vscode';

const projectName = path.basename(vscode.workspace.rootPath || "Error");

const manifestsDir = wsCfg<string>('k8s.manifestsDir');
const allowedContext = wsCfg<string>('tilt.allowedKubernetesContext');
const dockerBuildContextDir = wsCfg<string>('docker.buildContextDir');
const liveSyncSrc = wsCfg<string>('build.outputDir');
const appTargetPath = wsCfg<string>('docker.appTargetDir');
const port = wsCfg<number>('tilt.forwardPort');
const tiltFilePath = wsCfg<string>('tilt.tiltfilePath');
const buildOutputPath = wsCfg<string>('build.outputDir');
const dockerRegistry = wsCfg<string>('docker.defaultRegistry');

const tiltfile = 
`
allow_k8s_contexts('${allowedContext}')
k8s_yaml(kustomize('${manifestsDir}'))

docker_build('${dockerRegistry}/${projectName}', 
             '${dockerBuildContextDir}',
             live_update=[
                 sync('${liveSyncSrc}', '${appTargetPath}'),
                 restart_container()
             ])

k8s_resource('${projectName}', port_forwards=${port})
`;

const debuggerImage = wsCfg<string>('docker.debuggerImage');

const debugDockerFile =
`
FROM ${debuggerImage}

WORKDIR ${appTargetPath}
COPY ./${path.relative(dockerBuildContextDir, buildOutputPath)} ./
ENTRYPOINT ["dotnet", "${projectName}.dll"]
`;

const kustomization =
`
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: ${projectName}
resources:
- deployment.yaml
- namespace.yaml
images:
- name: ${projectName}
  newName: ${dockerRegistry}/${projectName}
  newTag: 0.0.0
`;

const deployment =
`
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: ${projectName}
  name: ${projectName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${projectName}
  template:
    metadata:
      labels:
        app: ${projectName}
    spec:
      containers:
      - image: ${projectName}
        name: ${projectName}
        ports:
          - containerPort: 5000
`;

const namespace = 
`
apiVersion: v1
kind: Namespace
metadata:
  name: ${projectName}
`;

export async function generateAssets() {

    try {

        const wsRoot = vscode.workspace.rootPath;
        if (!wsRoot) { return; }

        const createIfNotExists = (relativePath:string, assetData: string) => {
            const fullPath = path.join(wsRoot, relativePath);
            if (!fs.existsSync(fullPath)) 
            {
                fs.writeFile(fullPath, assetData, err => {
    
                    if (err) { vscode.window.showErrorMessage(`${err}`); }
                });
            }
        };
       
        const manifestsDirFullPath = path.join(wsRoot, manifestsDir);
        if (!fs.existsSync(manifestsDirFullPath)) 
        {
            fs.mkdirSync(manifestsDirFullPath, { recursive:true} );
        }

        createIfNotExists(tiltFilePath, tiltfile);
        createIfNotExists(path.join(manifestsDir, "kustomization.yaml"), kustomization);
        createIfNotExists(path.join(manifestsDir, "deployment.yaml"), deployment);
        createIfNotExists(path.join(manifestsDir, "namespace.yaml"), namespace);
        createIfNotExists(path.join(dockerBuildContextDir, "Dockerfile"), debugDockerFile);
    }
    catch (err) 
    {
        vscode.window.showErrorMessage(`${err}`);
    }
}
