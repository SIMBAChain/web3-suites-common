import {default as chalk} from 'chalk';
import {
    SimbaConfig,
    walkDirForContracts,
    promisifiedReadFile,
    getASTAndOtherInfo,
    discoverAndSetWeb3Suite,
    web3SuiteErrorMessage,
} from '../lib';

/**
 * this class is used to compare source code in simba.json to our build artifacts,
 * which helps us determine which contracts should/can be exported
 */
export class SourceCodeComparer {
    private sourceCodeFromSimbaJson: Record<any, any>;
    private sourceCodeFromArtifacts: Record<any, any>;
    private imports: Array<string>;

    /**
     * grabs source code for all compiled contracts from local build artifacts
     * @returns 
     */
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
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: Simba was not able to find any build artifacts.\nDid you forget to compile?\n`)}`);
            }
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(err)}`)}`);
            this.sourceCodeFromArtifacts = sourceCodeMap;
            return sourceCodeMap;
        }

        const web3Suite = discoverAndSetWeb3Suite();

        if (!web3Suite) {
            SimbaConfig.log.error(web3SuiteErrorMessage);
            return sourceCodeMap;
        }

        switch(web3Suite) {
            case HARDHAT: {
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

        SimbaConfig.log.debug(`:: EXIT : sourceCodeMap from Artifacts : ${JSON.stringify(sourceCodeMap)}`);
        this.sourceCodeFromArtifacts = sourceCodeMap;
        return sourceCodeMap;
    }

    /**
     * grabs source code from simba.json
     * contracts_info.<contract_name> exists after a file has been exported
     * @returns 
     */
    public getAndSetSourceCodeFromSimbaJson(): Record<any, any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        let sourceCodeMap = {} as any;
        if (!contractsInfo) {
            SimbaConfig.log.debug(`${chalk.cyanBright(`simba: no contracts_info found in simba.json`)}`);
            this.sourceCodeFromSimbaJson = sourceCodeMap;
            return sourceCodeMap;
        }
        for (let contractName in contractsInfo) {
            const sourceCode = contractsInfo[contractName].source_code;
            sourceCodeMap[contractName] = sourceCode;
        }
        SimbaConfig.log.debug(`:: EXIT : sourceCodeMap from simba.json : ${JSON.stringify(sourceCodeMap)}`);
        this.sourceCodeFromSimbaJson = sourceCodeMap;
        return sourceCodeMap;
    }

    /**
     * checks if source code for contractName exists in simba.json
     * @param contractName 
     * @returns 
     */
    public sourceCodeExistsInSimbaJson(contractName: string): boolean {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        this.initSimbaJsonSourceCode();
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

    /**
     * checks if source code for contractName exists in artifacts / build dir
     * @param contractName 
     * @returns 
     */
    public async sourceCodeExistsInArtifacts(contractName: string): Promise<boolean> {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        await this.initArtifactSourceCode();
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

    /**
     * compares build artifacts and simba.json to see if contract is new or updated
     * @param contractName 
     * @returns 
     */
    public async sourceCodeHasChangedOrIsNew(contractName: string): Promise<boolean> {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        await this.initSourceCode();
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

    /**
     * used to communicate to user the status of an attempted export
     * @param contractName 
     * @returns 
     */
    private async getStatusAndMessage(contractName: string): Promise<Record<any, any>> {
        SimbaConfig.log.debug(`:: ENTER : contractName: ${contractName}`);
        if (!this.sourceCodeFromArtifacts || !this.sourceCodeFromSimbaJson) {
            await this.initSourceCode();
        }
        if (!this.imports) {
            await this.getAndSetimports();
        }
        const nonExportMessage = "No changes detected; not exported";
        const attemptedExportMessage = "Error encountered with one or more contracts before export";
        // const exportMessage = "Exported";
        const isDependencyMessage = "Contract is a dependency; not exported"
        let statusAndMessage;

        if (this.imports.includes(contractName)) {
            statusAndMessage = {
                newOrChanged: false,
                message: `${chalk.gray(`${isDependencyMessage}`)}`
            }
        } else {
            if (!await this.sourceCodeHasChangedOrIsNew(contractName)) {
                statusAndMessage = {
                    newOrChanged: false,
                    message: `${chalk.gray(`${nonExportMessage}`)}`,
                }
            } else {
                // by default, we set export message to error, and then
                // let the plugins handle updating the message to success
                statusAndMessage = {
                    newOrChanged: true,
                    message: `${chalk.redBright(`${attemptedExportMessage}`)}`,
                }
            }
        }

        SimbaConfig.log.debug(`:: EXIT : statusAndMessage : ${JSON.stringify(statusAndMessage)}`);
        return statusAndMessage;
    }

    /**
     * calls getStatusAndMessage for each attempted contract export, to communicate
     * statuses to user when attempting exports
     * @param choices 
     * @returns 
     */
    public async exportStatuses(choices: Array<any> | string): Promise<Record<any, any>> {
        const _exportStatuses: Record<any, any> = {};
        await this.initSourceCode();
        await this.getAndSetimports();
        if (Array.isArray(choices)) {
            for (let i = 0; i < choices.length; i++) {
                const contractName = choices[i].title;
                const statusAndMessage = await this.getStatusAndMessage(contractName);
                _exportStatuses[contractName] = statusAndMessage;
            }
            SimbaConfig.log.debug(`:: EXIT : _exportStatuses: ${JSON.stringify(_exportStatuses)}`);
            return _exportStatuses;
        }
        const contractName = choices;
        const statusAndMessage = await this.getStatusAndMessage(contractName);
        _exportStatuses[contractName] = statusAndMessage;
        SimbaConfig.log.debug(`:: EXIT : _exportStatuses: ${JSON.stringify(_exportStatuses)}`);
        return _exportStatuses;
    }

    /**
     * sets simba.json and build artifact source code as property of this class
     */
    private async initSourceCode(): Promise<void> {
        await this.initArtifactSourceCode();
        this.initSimbaJsonSourceCode();
    }

    /**
     * sets build artifact source code as property of this class
     */
    private async initArtifactSourceCode(): Promise<void> {
        if (!this.sourceCodeFromArtifacts) {
            await this.getAndSetSourceCodeFromArtifacts();
        }
    }

    /**
     * sets simba.json source code as property of this class
     */
    private initSimbaJsonSourceCode(): void {
        if (!this.sourceCodeFromSimbaJson) {
            this.getAndSetSourceCodeFromSimbaJson();
        }
    }

    /**
     * this method is living in this class because it helps us determine
     * what to export or not. If an artifact has empty bytecode,
     * then it is an import (dependency), and we don't export it
     * @returns 
     */
    private async getAndSetimports(): Promise<Array<string>> {
        SimbaConfig.log.debug(`:: ENTER :`);
        let files;
        const importedContracts: Array<string> = [];
        const buildDir = SimbaConfig.buildDirectory;
        try {
            files = await walkDirForContracts(buildDir, '.json');
        } catch (e) {
            const err = e as any;
            if (err.code === 'ENOENT') {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : Simba was not able to find any build artifacts.\nDid you forget to compile?\n`)}`);
            }
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(err)}`)}`);
            return importedContracts;
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
            const byteCode = parsed.bytecode;
            if (byteCode === "0x") {
                importedContracts.push(contractName);
            }
        }
        SimbaConfig.log.debug(`:: EXIT : importedContracts : ${JSON.stringify(importedContracts)}`);
        this.imports = importedContracts;
        return importedContracts;
    }
}