import * as fs from "fs";
import * as path from 'path';
import {cwd} from 'process';
import {
    SimbaConfig,
    getASTAndOtherInfo,
} from "./";
import {default as chalk} from 'chalk';

const SimbaPath = "/SimbaImports";

/**
 * function used in many operations in this module. helps us find compiled contracts
 * @param dir 
 * @param extension 
 * @returns 
 */
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

/**
 * helps read file once we've found it
 * @param filePath 
 * @param options 
 * @returns 
 */
export const promisifiedReadFile = (filePath: fs.PathLike, options: { encoding?: null; flag?: string }): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        fs.readFile(filePath, options, (err: NodeJS.ErrnoException | null, data: Buffer) => {
            if (err) {
                return reject(err);
            }
            return resolve(data);
        });
    });

export async function absolutePaths(): Promise<Record<any, any> | void> {
    SimbaConfig.log.debug(`:: ENTER :`);
    const buildDir = SimbaConfig.buildDirectory;
    let files: string[] = [];
    const absolutePathMap = {} as any;
    try {
        files = await walkDirForContracts(buildDir, '.json');
    } catch (e) {
        const err = e as any;
        if (err.code === 'ENOENT') {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : Simba was not able to find any build artifacts.\nDid you forget to run: "npx hardhat compile" ?\n`)}`);
        }
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(err)}`)}`);
        return;
    }
    for (const file of files) {
        if (file.endsWith('Migrations.json') || file.endsWith('dbg.json')) {
            continue;
        }
        const buf = await promisifiedReadFile(file, {flag: 'r'});
        if (!(buf instanceof Buffer)) {
            continue;
        }
        const parsed = JSON.parse(buf.toString());
        const contractName = parsed.contractName;
        console.log('contractName: ', contractName);
        const contractSourceName = parsed.sourceName;
        const astAndOtherInfo = await getASTAndOtherInfo(contractName, contractSourceName) as any;
        let absPath = astAndOtherInfo.ast.absolutePath ?
            astAndOtherInfo.ast.absolutePath :
            `contracts/${contractName}.sol`;
        console.log('absPath: ', absPath);
        absolutePathMap[contractName] = absPath;
    }
    SimbaConfig.log.debug(`:: EXIT : absolutePathMap : ${JSON.stringify(absolutePathMap)}`);
    return absolutePathMap;
}

export function contractAbsolutePath(
    _absolutePaths: Record<any, any>,
    contractName: string,
): string {
    const entryParams = {
        _absolutePaths,
        contractName,
    }
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);
    const contractPath = _absolutePaths[contractName];
    SimbaConfig.log.debug(`:: EXIT : ${contractPath}`);
    return contractPath;
}

export function contractSimbaPath(
    _absolutePaths: Record<any, any>,
    contractName: string,
): string {
    SimbaConfig.log.debug(`:: ENTER : }`);
    const contractPath = contractAbsolutePath(_absolutePaths, contractName) ?
        contractAbsolutePath(_absolutePaths, contractName) :
        `contracts/${contractName}.sol`;
    const base = contractPath.split("/")[0];
    const newPathWithSimba = base + SimbaPath + contractPath.slice(base.length);
    const newAbsoluteSimbaPath = path.join(cwd(), newPathWithSimba);
    const newAbsoluteDir = path.dirname(newAbsoluteSimbaPath);
    if (!fs.existsSync(newAbsoluteDir)) {
        fs.mkdirSync(newAbsoluteDir, { recursive: true });
    }
    // we're writing to contractName.sol instead of original file name,
    // because if there were multiple contracts in someFileName.sol, we would lose
    // all but one of them
    const fileNameReplacedWithContractName = path.join(newAbsoluteDir, `${contractName}.sol`);
    SimbaConfig.log.debug(`:: EXIT : ${fileNameReplacedWithContractName}`);
    return fileNameReplacedWithContractName;
}