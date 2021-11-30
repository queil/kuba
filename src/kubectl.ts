export class Kubectl {

    private onError: (s: string) => {};
    constructor(onError: (s: string) => {}) {
        this.onError = onError;
    }

    async kubectl(argsString: string): Promise<string> {
        const util = require('util');
        const exec = util.promisify(require('child_process').exec);
        const { stdout, stderr } = await exec(`kubectl ${argsString}`);
        if (stderr) {
            this.onError(stderr);
            return "Error";
        }
        return stdout.trim();
    }

    public async get(argsString: string) {
        const stdout = await this.kubectl(`${argsString} -o name`);
        const items = stdout.split("\n").flatMap((s: string) => s.split('/').slice(-1)[0]);
        return items;
    }

    public async getContainersInPod(pod: string, ns: string, ignoreNotFound: boolean) {
        const stdout = await this.kubectl(`get pod ${pod} -n ${ns} ${ignoreNotFound ? "--ignore-not-found" : ""} -o jsonpath="{.spec.containers[*].name}"`);
        return stdout.split(" ");
    }
}
