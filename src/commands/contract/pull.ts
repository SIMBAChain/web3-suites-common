import fs from 'fs';
import path from 'path';
import {default as chalk} from 'chalk';
import {SimbaConfig} from '../lib';
import {ContractDesignWithCode} from '.';
import {default as prompt} from 'prompts';
import axios from "axios";
import {ContractDesign} from "."
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
export async function _pullContract(designID: string): Promise<void> {
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
            const contractFileName = path.join(SimbaConfig.contractDirectory, `${contractDesign.name}.sol`);
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

export async function pullContracts(designID?: string): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER : designID: ${designID}`);
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
        message: '"simba pull" will overwrite local versions of .sol files in your contracts directory. Do you want to proceed?',
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

    if (designID) {
        await _pullContract(designID);
        SimbaConfig.log.debug(`:: EXIT :`)
        return;
    }

    try {
        const contracts = await allContracts();
        const choices = [];
        if (contracts) {
            const contractDesigns = contracts as ContractDesign[];
            for (let i = 0; i < contractDesigns.length; i++) {
                const title = `${chalk.green(contractDesigns[i].name)} :: ${chalk.green("id")} ${
                    contractDesigns[i].id} :: ${chalk.green("created_on")} ${contractDesigns[i].created_on} ::${chalk.green("updated_on")} ${contractDesigns[i].updated_on}`;
                const value = contractDesigns[i].id;
                choices.push({title: title, value: value});
            }
        } else {
            SimbaConfig.log.error(`\nsimba: error obtaining contracts`);
        }
        const chosen = await prompt({
            type: 'multiselect',
            name: 'contracts',
            message: `${chalk.cyanBright(`Please select all contracts you want to sync. Use the Space Bar to select or un-select a contract (You can also use -> to select a contract, and <- to un-select a contract). Hit Return/Enter when you are ready to sync your contracts. This will overwrite any local versions of selected contracts.`)}`,
            choices,
        });
        for (let i = 0; i < chosen.contracts.length; i++) {
            const id = chosen.contracts[i];
            await _pullContract(id);
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

export async function pullAllMostRecentContracts(): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER :`);
    try {
        const contracts = await allContracts();
        const contractNames: string[] = [];
        if (contracts) {
            const contractDesigns = contracts as ContractDesign[];
            for (let i = 0; i < contractDesigns.length; i++) {
                if (contractNames.includes(contractDesigns[i].name)) {
                    // this will avoid pulling old versions of contracts
                    continue;
                }
                await _pullContract(contractDesigns[i].id);
                contractNames.push(contractDesigns[i].name);
            }
            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: all most recent .sol contract files pulled from SIMBA Chain.`)}`);
        } else {
            SimbaConfig.log.error(`\nsimba: error obtaining contracts`);
        }
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


