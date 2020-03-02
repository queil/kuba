import * as fs from 'fs';
const es = require('event-stream');

export class LogReader {

    private FileName:string;
    private TotalOffset:number = 0;
    constructor(fileName:string)
    {
        this.FileName = fileName;
    }
    public Stream = (callback: (line:string) => void) =>
    {   let offset = 1;
        const s = 
            fs.createReadStream(this.FileName)
              .pipe(es.split())
              .pipe(es.filterSync((_:string) => { return offset > this.TotalOffset; }))
              .pipe(
                es.mapSync((ln:string) => {
                    s.pause();
                    callback(ln);
                    this.TotalOffset++;
                    offset++;
                    s.resume();
                }).on('error', (err:string) => { console.log('Error while reading file.', err); })
                  .on('end', () => { console.log('Read entire file.'); })
              );
    }
}