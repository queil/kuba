import * as fs from 'fs';

export class LogReader {

    private FileName:string;
    constructor(fileName:string)
    {
        this.FileName = fileName;
        console.log(`LogReader: ${fileName}`);
    }
    public Stream = (callback: (line:string) => void) =>
    {   
        const s =  fs.createReadStream(this.FileName);
        return new Promise<void>((resolve, reject) => {
            s.on('data', (chunk:Buffer) => { callback(chunk.toString('utf8')); })
             .on('end', () => { resolve();})
             .on('error', _ => { reject();  });
        });  
    }
}