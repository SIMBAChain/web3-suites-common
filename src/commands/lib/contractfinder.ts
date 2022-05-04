import * as fs from "fs";
import * as path from 'path';

export const walkDirForContracts = (dir: string, extension: string): Promise<string[]> =>
new Promise((resolve, reject) => {
    fs.readdir(dir, {withFileTypes: true}, async (err, entries) => {
        if (err) {
            return reject(err);
        }

        let files: string[] = [];

        for (const entry of entries) {
            if (entry.isFile()) {
                const filePath = path.join(dir, entry.name);
                if (!extension || (extension && path.parse(filePath).ext === extension)) {
                    files.push(filePath);
                }
            } else if (entry.isDirectory()) {
                try {
                    const subFiles = await walkDirForContracts(path.join(dir, entry.name), extension);
                    files = files.concat(subFiles);
                } catch (e) {
                    reject(e);
                }
            }
        }

        resolve(files);
    });
});

export const promisifiedReadFile = (filePath: fs.PathLike, options: { encoding?: null; flag?: string }): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        fs.readFile(filePath, options, (err: NodeJS.ErrnoException | null, data: Buffer) => {
            if (err) {
                return reject(err);
            }
            return resolve(data);
        });
    });