import * as fs from 'fs';

export class LogReader {

    private fileName: string;
    constructor(fileName: string) {
        this.fileName = fileName;
        console.log(`LogReader: ${fileName}`);
    }
    public stream = (callback: (line: string) => void) => {
        const s = fs.createReadStream(this.fileName);
        return new Promise<void>((resolve, reject) => {
            s.on('data', (chunk: Buffer) => { callback(chunk.toString('utf8')); })
                .on('end', () => { resolve(); })
                .on('error', _ => { reject(); });
        });
    };
}
