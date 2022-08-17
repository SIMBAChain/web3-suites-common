import {
    promisifiedReadFile,
    SimbaConfig,
} from "../.."
import * as fs from "fs";
import * as path from 'path';

class FileHandler {
    public static async transferFile(
        inputPath: string,
        outputPath: string,
    ): Promise<void> {
        const buf = await promisifiedReadFile(inputPath, {flag: 'r'});
        const parsed = JSON.parse(buf.toString());
        const data = JSON.stringify(parsed);
        SimbaConfig.log.info(`:: writing contents of ${inputPath} to ${outputPath}`);
        // before writing, need to recursively create path to outputPath
        this.makeDirectory(outputPath);
        fs.writeFileSync(outputPath, data);
    }

    public static makeDirectory(filePath: string) {
        const dirName = path.dirname(filePath);
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }
    }

    public static removeDirectory(filePath: string) {
        try {
            fs.rmdirSync(filePath, { recursive: true });
        } catch (err) {
            console.error(`Error while deleting ${filePath}.`);
        }
    }
}
