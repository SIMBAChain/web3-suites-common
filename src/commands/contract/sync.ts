import fs from 'fs';
import path from 'path';
import {default as chalk} from 'chalk';
import {SimbaConfig} from '../lib';
import {ContractDesignWithCode} from './';

/**
 * syncs contractX saved in simbachain.com with contractX in your project directory
 * @param {Promise<void>} designID 
 */
export async function syncContract(designID: string): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER : ${designID}`);
    let contractDesign: ContractDesignWithCode;
    const resp = await SimbaConfig.authStore.doGetRequest(
        `organisations/${SimbaConfig.organisation.id}/contract_designs/${designID}`,
    );
    SimbaConfig.log.debug(`resp: ${JSON.stringify(resp)}`);
    if (resp && !(resp instanceof Error)) {
        contractDesign = resp as ContractDesignWithCode;
        const contractFileName = path.join(SimbaConfig.contractDirectory, `${contractDesign.name}.sol`);
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: syncing file ${chalk.greenBright(`${contractDesign.name}`)} ---> ${chalk.greenBright(`${contractFileName}`)}`)}`);
        fs.writeFileSync(contractFileName, Buffer.from(contractDesign.code, 'base64').toString());
        SimbaConfig.log.info(`${chalk.cyanBright(`simba: finished syncing ${chalk.greenBright(`${contractDesign.name}`)} ---> ${chalk.greenBright(`${contractFileName}`)}`)}`);
    } else {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: error acquiring contract design for ${chalk.greenBright(`${designID}`)}`)}`)
    }
    SimbaConfig.log.debug(`:: EXIT :`);
}

