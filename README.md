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
