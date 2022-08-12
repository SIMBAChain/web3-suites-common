import fs from 'fs';
import path from 'path';
import {default as chalk} from 'chalk';
import {
    SimbaConfig,
    absolutePaths,
    contractSimbaPath,
} from '../lib';
import {ContractDesignWithCode} from '.';
import {default as prompt} from 'prompts';
import axios from "axios";
import {
    allContracts,
} from "./list";
import {
    authErrors,
} from "../lib/authentication";

/**
 * syncs contractX saved in simbachain.com with contractX in your project directory
 * @param {Promise<void>} designID 
 */
export async function pullContractFromDesignId(
    designID: string,
    useSimbaPath: boolean = true,
    absPaths?: Record<any, any>,
): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER : ${designID}`);
    let contractDesign: ContractDesignWithCode;
    const authStore = await SimbaConfig.authStore();
    if (authStore) {
        const resp = await authStore.doGetRequest(
            `organisations/${SimbaConfig.organisation.id}/contract_designs/${designID}`,
        );
        SimbaConfig.log.debug(`resp: ${JSON.stringify(resp)}`);
        if (resp && !(resp instanceof Error)) {
            contractDesign = resp as ContractDesignWithCode;
            let contractFileName;
            if (useSimbaPath) {
                if (!absPaths) {
                    absPaths = await absolutePaths() as any;
                }
                contractFileName = contractSimbaPath(absPaths as any, contractDesign.name);
            } else {
                contractFileName = path.join(SimbaConfig.contractDirectory, `${contractDesign.name}.sol`);
            }
            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: pulling file ${chalk.greenBright(`${contractDesign.name}`)} ---> ${chalk.greenBright(`${contractFileName}`)}`)}`);
            fs.writeFileSync(contractFileName, Buffer.from(contractDesign.code, 'base64').toString());
            SimbaConfig.log.info(`${chalk.cyanBright(`simba: finished pulling ${chalk.greenBright(`${contractDesign.name}`)} ---> ${chalk.greenBright(`${contractFileName}`)}`)}`);
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: error acquiring contract design for ${chalk.greenBright(`${designID}`)}`)}`)
        }
        SimbaConfig.log.debug(`:: EXIT :`);
    } else {
        SimbaConfig.log.error(authErrors.badAuthProviderInfo);
    }
}

export async function pullContractFromContractDesign(
    contractDesign: ContractDesignWithCode,
    useSimbaPath: boolean = true,
    absPaths?: Record<any, any>,
): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(contractDesign)}`);
    let contractFileName;
    if (useSimbaPath) {
        if (!absPaths) {
            absPaths = await absolutePaths() as any;
        }
        contractFileName = contractSimbaPath(absPaths as any, contractDesign.name);
    } else {
        contractFileName = path.join(SimbaConfig.contractDirectory, `${contractDesign.name}.sol`);
    }
    SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: pulling file ${chalk.greenBright(`${contractDesign.name}`)} ---> ${chalk.greenBright(`${contractFileName}`)}`)}`);
    fs.writeFileSync(contractFileName, Buffer.from(contractDesign.code, 'base64').toString());
    SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: finished pulling ${chalk.greenBright(`${contractDesign.name}`)} ---> ${chalk.greenBright(`${contractFileName}`)}`)}`);
    SimbaConfig.log.debug(`:: EXIT :`);
}

export async function pullContractsInteractive(
    contractDesignArray?: ContractDesignWithCode[],
    useSimbaPath: boolean = true,
    absPaths?: Record<any, any>,
): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER : entryParams: ${JSON.stringify(contractDesignArray)}`);
    const NO = "NO";
    const YES = "YES";
    const overWriteOK = [NO, YES];
    const overWriteChoices = [];
    for (let i = 0; i < overWriteOK.length; i++) {
        const entry = overWriteOK[i];
        overWriteChoices.push({
            title: entry,
            value: entry,
        });
    }
    const overWriteChoice = await prompt({
        type: 'select',
        name: 'over_write_ok',
        message: '"simba pull" will overwrite local versions of .sol files in your contracts directory. Also, all pulled contracts will be written to the top level of your /contracts/ directory. Do you want to proceed?',
        choices: overWriteChoices,
    });
    
    if (!overWriteChoice.over_write_ok) {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : no choice selected; exiting without pulling.`)}`);
        return;
    }
    if (overWriteChoice.over_write_ok === NO) {
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: EXIT : exiting without pulling.`)}`);
        return;
    }

    try {
        if (useSimbaPath) {
            if (!absPaths) {
                absPaths = await absolutePaths() as any;
            }
        }
        const contractDesigns = contractDesignArray ?
            contractDesignArray :
            await allContracts();
        const choices = [];
        if (contractDesigns) {
            for (let i = 0; i < contractDesigns.length; i++) {
                const title = `${chalk.green(contractDesigns[i].name)} :: ${chalk.green("id")} ${
                    contractDesigns[i].id} :: ${chalk.green("created_on")} ${contractDesigns[i].created_on} :: ${chalk.green("updated_on")} ${contractDesigns[i].updated_on}`;
                const value = contractDesigns[i];
                choices.push({title: title, value: value});
            }
        } else {
            SimbaConfig.log.error(`\nsimba: error obtaining contracts`);
            return;
        }
        const chosen = await prompt({
            type: 'multiselect',
            name: 'contracts',
            message: `${chalk.cyanBright(`Please select all contracts you want to sync. Use the Space Bar to select or un-select a contract (You can also use -> to select a contract, and <- to un-select a contract). Hit Return/Enter when you are ready to sync your contracts. This will overwrite any local versions of selected contracts.`)}`,
            choices,
        });
        for (let i = 0; i < chosen.contracts.length; i++) {
            const contractDesign = chosen.contracts[i];
            await pullContractFromContractDesign(contractDesign, useSimbaPath, absPaths);
        }
        return;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`);
            return;
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            return;
        }
    }
}

export async function pullAllMostRecentContracts(
    contractDesigns: ContractDesignWithCode[],
    useSimbaPath: boolean = true,
    absPaths?: Record<any, any>,
): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER :`);
    const contractNames: string[] = [];
    if (useSimbaPath) {
        if (!absPaths) {
            absPaths = await absolutePaths() as any;
        }
    }
    for (let i = 0; i < contractDesigns.length; i++) {
        if (contractNames.includes(contractDesigns[i].name)) {
            // this will avoid pulling old versions of contracts
            continue;
        }
        await pullContractFromContractDesign(contractDesigns[i], useSimbaPath, absPaths);
        contractNames.push(contractDesigns[i].name);
    }
    SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: all source code in simba.json up to date.`)}`);
    SimbaConfig.log.debug(`:: EXIT :`);
}

function pullSourceCodeForSimbaJson(contractDesign: ContractDesignWithCode): void {
    SimbaConfig.log.debug(`:: ENTER :`);
    const contractsInfo: Record<any, any> = SimbaConfig.ProjectConfigStore.get("contracts_info") ?
        SimbaConfig.ProjectConfigStore.get("contracts_info") :
        {};
    const singleContractInfo = contractsInfo[contractDesign.name] ?
        contractsInfo[contractDesign.name] :
        {};
    singleContractInfo.design_id = contractDesign.id;
    singleContractInfo.source_code = Buffer.from(contractDesign.code, 'base64').toString();
    contractsInfo[contractDesign.name] = singleContractInfo;
    SimbaConfig.ProjectConfigStore.set("contracts_info", contractsInfo);
    SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: pulling source code for ${chalk.greenBright(`${contractDesign.name}`)} ---> simba.json`)}`);
    SimbaConfig.log.debug(`:: EXIT :`);
}

export function pullAllMostRecentSourceCodeForSimbaJson(contractDesigns: ContractDesignWithCode[]): void {
    SimbaConfig.log.debug(`:: ENTER :`);
    SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: now pulling source code ---> simba.json`)}`);
    const contractNames: string[] = [];
    for (let i = 0; i < contractDesigns.length; i++) {
        if (contractNames.includes(contractDesigns[i].name)) {
            // this will avoid pulling old versions of contracts
            continue;
        }
        pullSourceCodeForSimbaJson(contractDesigns[i]);
        contractNames.push(contractDesigns[i].name);
    }
    SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: all source code in simba.json up to date.`)}`);
    SimbaConfig.log.debug(`:: EXIT :`);
}

export async function pullMostRecentRecentSolFileFromContractName(
    contractName: string,
    contractDesignArray: ContractDesignWithCode[] | null = null,
    useSimbaPath: boolean = true,
    absPaths?: Record<any, any>,
): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER :`);
    const contractDesigns = contractDesignArray ?
        contractDesignArray :
        await allContracts();
    if (useSimbaPath) {
        if (!absPaths) {
            absPaths = await absolutePaths() as any;
        }
    }
    if (contractDesigns) {
        for (let i = 0; i < contractDesigns.length; i++) {
            if (contractDesigns[i].name === contractName) {
                await pullContractFromContractDesign(contractDesigns[i], useSimbaPath, absPaths);
                SimbaConfig.log.debug(`:: EXIT :`);
                return;
            }
        }
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: no contract found with name ${contractName}`)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    } else {
        SimbaConfig.log.error(`\nsimba: error obtaining contracts`);
    }
}

export async function pullMostRecentSourceCodeFromContractName(
    contractName: string,
    contractDesignArray: ContractDesignWithCode[] | null = null,
): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER :`);
    const contractDesigns = contractDesignArray ?
        contractDesignArray :
        await allContracts();
    if (contractDesigns) {
        for (let i = 0; i < contractDesigns.length; i++) {
            if (contractDesigns[i].name === contractName) {
                pullSourceCodeForSimbaJson(contractDesigns[i]);
                SimbaConfig.log.debug(`:: EXIT :`);
                return;
            }
        }
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: no contract found with name ${contractName}`)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    } else {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: error obtaining contracts`)}`);
    }
}

export async function pullMostRecentFromContractName(
    contractName: string,
    contractDesignArray?: ContractDesignWithCode[],
    useSimbaPath: boolean = true,
    absPaths?: Record<any, any>,
): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER :`);
    const contractDesigns = contractDesignArray ?
        contractDesignArray :
        await allContracts();
    if (useSimbaPath) {
        if (!absPaths) {
            absPaths = await absolutePaths() as any;
        }
    }
    if (contractDesigns) {
        await pullMostRecentSourceCodeFromContractName(contractName, contractDesigns);
        await pullMostRecentRecentSolFileFromContractName(contractName, contractDesigns, useSimbaPath, absPaths);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    } else {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: error obtaining contracts`)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }
}

export async function pullAllMostRecentSolFilesAndSourceCode(
    pullSourceCodeFiles: boolean = true,
    pullSolFiles: boolean = false,
    interactive: boolean = false,
    useSimbaPath: boolean = true,
    absPaths?: Record<any, any>,
): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER :`);
    const contractDesigns = await allContracts();
    if (useSimbaPath) {
        if (!absPaths) {
            absPaths = await absolutePaths() as any;
        }
    }
    if (!contractDesigns) {
        SimbaConfig.log.debug(`no contract designs found. exiting.`);
        return;
    }
    if (pullSourceCodeFiles) {
        pullAllMostRecentSourceCodeForSimbaJson(contractDesigns);
    }
    if (pullSolFiles) {
        if (interactive) {
            await pullContractsInteractive(contractDesigns, useSimbaPath, absPaths);
        } else {
            await pullAllMostRecentContracts(contractDesigns, useSimbaPath, absPaths);
        }
    }
}



