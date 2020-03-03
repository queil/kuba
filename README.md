![Kuba](/media/kuba.128.png) 

# Kuba [![Build Status](https://dev.azure.com/queil/kuba/_apis/build/status/queil.kuba?branchName=master)](https://dev.azure.com/queil/kuba/_build/latest?definitionId=1&branchName=master)

Easy Kubernetes Debugging for .NET Core in VS Code.

# What is Kuba?

Kuba's goal is to make both local and remote debugging .NET Core code (C#, F#) in Kubernetes feel like the old good local-development-like experience (or even better!). Kuba joins the remote-debugging powers of the C# VS Code extension with the live-sync capabilities of [tilt](https://tilt.dev/).

![Kuba-Gif](/media/kuba2.gif)

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


