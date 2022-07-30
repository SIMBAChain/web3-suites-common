import {default as chalk} from 'chalk';
import {
    SimbaConfig,
    walkDirForContracts,
    promisifiedReadFile,
    getASTAndOtherInfo,
} from '../lib';

export class SourceCodeComparer {
    private sourceCodeFromSimbaJson: Record<any, any>;
    private sourceCodeFromArtifacts: Record<any, any>;

    // first need a method that grabs source code for all compiled contracts
    // source code exists in artifact after compiling
    public async getAndSetSourceCodeFromArtifacts(): Promise<Record<any, any>> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const buildDir = SimbaConfig.buildDirectory;
        let files: string[] = [];
        let sourceCodeMap = {} as any;
        const HARDHAT = "hardhat";
        const TRUFFLE = "truffle";
        try {
            files = await walkDirForContracts(buildDir, '.json');
        } catch (e) {
            const err = e as any;
            if (err.code === 'ENOENT') {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : Simba was not able to find any build artifacts.\nDid you forget to run: "npx hardhat compile" ?\n`)}`);
            }
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(err)}`)}`);
            this.sourceCodeFromArtifacts = sourceCodeMap;
            return sourceCodeMap;
        }

        const web3Suite = SimbaConfig.ProjectConfigStore.get("web3Suite").toLowerCase();

        if (!web3Suite) {
            SimbaConfig.log.error(`${chalk.redBright(`simba: web3Suite not set in simba.json`)}`);
            return sourceCodeMap;
        }

        switch(web3Suite) {
            case HARDHAT: {
                for (const file of files) {
                    if (file.endsWith('Migrations.json') || file.endsWith('dbg.json')) {
                        continue;
                    }
                    SimbaConfig.log.debug(`${chalk.green(`\nsimba export: reading file: ${file}`)}`);
                    const buf = await promisifiedReadFile(file, {flag: 'r'});
                    if (!(buf instanceof Buffer)) {
                        continue;
                    }
                    const parsed = JSON.parse(buf.toString());
                    const contractName = parsed.contractName;
                    const contractSourceName = parsed.sourceName;
                    const astAndOtherInfo = await getASTAndOtherInfo(contractName, contractSourceName) as any;
                    const sourceCode = astAndOtherInfo.source;
                    sourceCodeMap[contractName] = sourceCode;
                }
                break; 
            }
            case TRUFFLE: {
                for (const file of files) {
                    if (file.endsWith('Migrations.json')) {
                        continue;
                    }
                    SimbaConfig.log.debug(`${chalk.green(`\nsimba export: reading file: ${file}`)}`);
                    const buf = await promisifiedReadFile(file, {flag: 'r'});
                    if (!(buf instanceof Buffer)) {
                        continue;
                    }
                    const parsed = JSON.parse(buf.toString());
                    const contractName = parsed.contractName;
                    const sourceCode = parsed.source;
                    sourceCodeMap[contractName] = sourceCode;
                }
                break;
            }
            default: { 
                SimbaConfig.log.error(`${chalk.redBright(`simba: ${web3Suite} is not a supported web3Suite`)}`);
                break; 
            }
        }

        SimbaConfig.log.debug(`${chalk.cyanBright(`:: EXIT : sourceCodeMap : ${JSON.stringify(sourceCodeMap)}`)}`)
        this.sourceCodeFromSimbaJson = sourceCodeMap;
        return sourceCodeMap;
    }

    // then need a method that grabs source code from simba.json
    // contracts_info.<contract_name> exists after a file has beeen
    // exported
    public getAndSetSourceCodeFromSimbaJson(): Record<any, any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        let sourceCodeMap = {} as any;
        if (!contractsInfo) {
            SimbaConfig.log.debug(`${chalk.cyanBright(`simba: no contracts_info found in simba.json`)}`);
            this.sourceCodeFromArtifacts = sourceCodeMap;
            return sourceCodeMap;
        }
        for (let contractName in contractsInfo) {
            const sourceCode = contractsInfo[contractName].source_code;
            sourceCodeMap[contractName] = sourceCode;
        }
        SimbaConfig.log.debug(`:: EXIT : sourceCodeMap : ${JSON.stringify(sourceCodeMap)}`);
        this.sourceCodeFromSimbaJson = sourceCodeMap;
        return sourceCodeMap;
    }

    // then a method to check if source code for contractName exists in simba.json:
    public sourceCodeExistsInSimbaJson(contractName: string): boolean {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        if (!this.sourceCodeFromSimbaJson) {
            this.getAndSetSourceCodeFromSimbaJson();
        }
        if (Object.keys(this.sourceCodeFromSimbaJson).length === 0) {
            SimbaConfig.log.debug(`:: EXIT : false`);
            return false;
        }
        if (this.sourceCodeFromSimbaJson[contractName]) {
            SimbaConfig.log.debug(`:: EXIT : true`);
            return true;
        } else {
            SimbaConfig.log.debug(`:: EXIT : false`);
            return false;
        }
    }

    // then a method to check if source code for contractName exists in artifacts / build dir:
    public async sourceCodeExistsInArtifacts(contractName: string): Promise<boolean> {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        if (!this.sourceCodeFromArtifacts) {
            this.getAndSetSourceCodeFromArtifacts();
        }
        if (Object.keys(this.sourceCodeFromArtifacts).length === 0) {
            SimbaConfig.log.debug(`:: EXIT : false`);
            return false;
        }
        if (this.sourceCodeFromArtifacts[contractName]) {
            SimbaConfig.log.debug(`:: EXIT : true`);
            return true;
        } else {
            SimbaConfig.log.debug(`:: EXIT : false`);
            return false;
        }
    }

    // then need a method that runs through and checks for differences
    public async sourceCodeHasChangedOrIsNew(contractName: string): Promise<boolean> {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        if (!this.sourceCodeExistsInArtifacts(contractName)) {
            SimbaConfig.log.error(`${chalk.redBright(`simba: source code for ${contractName} does not exist in your artifacts. Did you forget to compile your contracts?`)}`);
            SimbaConfig.log.debug(`:: EXIT :`);
            return true;
        }
        if (!this.sourceCodeExistsInSimbaJson(contractName)) {
            SimbaConfig.log.debug(`source code is new: returning true`);
            SimbaConfig.log.debug(`:: EXIT :`);
            return true;
        }
        // existence of source code in both locations has been checked
        // now checking for sameness
        if (this.sourceCodeFromArtifacts[contractName] !== this.sourceCodeFromSimbaJson[contractName]) {
            SimbaConfig.log.debug(`artifact source code and simba.json source code are different: returning true`);
            SimbaConfig.log.debug(`:: EXIT :`);
            return true;
        } else {
            SimbaConfig.log.debug(`source code in simba.json and artifacts match. returning false`);
            return false;
        }   
    }
}