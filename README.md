![Kuba](/media/kuba.128.png) 

# Kuba [![Build Status](https://dev.azure.com/queil/kuba/_apis/build/status/queil.kuba?branchName=master)](https://dev.azure.com/queil/kuba/_build/latest?definitionId=1&branchName=master)

Easy Kubernetes Debugging for .NET Core in VS Code.



# What is Kuba?

Kuba's goal is to make both local and remote debugging .NET Core code (C#, F#) in Kubernetes feel like the old good local-development-like experience (or even better!). Kuba joins the remote-debugging powers of the C# VS Code extension with the live-sync capabilities of [tilt](https://tilt.dev/).

# Features

* It generates `dotnet build` and `tilt up` tasks in `tasks.json`
* It generates a remote-attach launch config in `launch.json`
* It lets the user to pick the Kubernetes context, namespace, pod, and finally the container to debug before attaching
* It auto-picks a resource given there is only a single one (e.g. only one pod in a namespace will be automatically picked)
* It stores the last used configuration so attaching to the same container again is just hitting `F5`  
* It uses tilt to inject files from your local build output straight into the target container
* It uses tilt to auto port-forward your pod to `localhost` so your service/website is easily accessible
* It respects the `kubectl` context and updates it if it changes externally
* It does not require the Microsoft's VS Code Kubernetes extension

# To do

* make it more configurable
* add an option to auto-re-attach on after build
* make Kubernetes picker a step pick list for a better UX
* add assets generation: a minimal Tiltfile and a minimal Kubernetes deployment
* move focus back onto the `tilt up` task output after `dotnet build`

# Requirements

* [VS Code](https://code.visualstudio.com/)
* [Kubernetes](https://kubernetes.io/) cluster
* [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/)
* [tilt](https://tilt.dev/)
* [.NET Core Sdk](https://dotnet.microsoft.com/download)
* [C# for VSCode extension](https://github.com/OmniSharp/omnisharp-vscode)
* If on Windows - [WSL2](https://docs.microsoft.com/en-us/windows/wsl/wsl2-install) as tilt just works better on Linux

# Try it

Before make sure you have a local (or a remote) Kubernetes cluster accessible via your `kubectl`.

1. Install the extension in VS Code or [from here](https://marketplace.visualstudio.com/items?itemName=queil.kuba)
2. Clone and open in VS Code my model project `git clone git@github.com:queil/k8s-debug-poc.git`
3. Follow the instructions in [README.md](https://github.com/queil/k8s-debug-poc/blob/master/README.md)
4. Hit `F1` and run the `Tasks: Configure Task` action for both `dotnet-build` and `tilt-up` tasks
5. Run the `dotnet-build` task
6. Run the `tilt-up` task
7. Hit `F5` and go through the pod selection and enjoy the debugging.


