![Kuba](/media/kuba.128.png) 

# Kuba

Easy Kubernetes Debugging for .NET Core in VS Code

# What is Kuba?

Kuba's goal is to make debugging .NET Core code (C#, F#) in Kubernetes feel like the old good local-development-like experience. Kuba joins the remote-debugging powers of the C# VS Code extension with the live-sync capabilities of [tilt](https://tilt.dev/).

# Features

* It generates `dotnet build` and `tilt up` tasks in `tasks.json`
* It generates a remote-attach launch config in `launch.json`
* It lets the user to pick the Kubernetes context, namespace, pod, and finally the container to debug before attaching
* It auto-picks a resource given there is only a single one (e.g. only one pod in a namespace will be automatically picked)
* It stores the last used configuration so attaching to the same container again is just hitting `F5`  
* It uses tilt to inject files from your local build output straight into the target container
* It uses tilt to auto port-forward your pod to `localhost` so your service/website is easily accessible
* It respects the `kubectl` context and updates it if it changes externally

# To do

* make it more configurable
* add an option to auto-re-attach on after build
* make Kubernetes picker a step pick list for a better UX
* add assets generation: a minimal Tiltfile and a minimal Kubernetes deployment
* move focus back onto the `tilt up` task output after `dotnet build`

# Try it



# Requirements

* [VS Code](https://code.visualstudio.com/)
* [Kubernetes](https://kubernetes.io/) cluster
* [kubectl](https://kubernetes.io/docs/reference/kubectl/overview/)
* [tilt](https://tilt.dev/)
* [.NET Core Sdk](https://dotnet.microsoft.com/download)
* [C# for VSCode extension](https://github.com/OmniSharp/omnisharp-vscode)