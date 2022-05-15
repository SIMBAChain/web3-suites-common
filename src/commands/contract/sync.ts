import fs from 'fs';
import path from 'path';
import {default as chalk} from 'chalk';
import {SimbaConfig} from '../lib';
import {ContractDesignWithCode} from './';

export async function syncContract(designID: string): Promise<void> {
    let contractDesign: ContractDesignWithCode;
    const resp = await SimbaConfig.authStore.doGetRequest(
        `organisations/${SimbaConfig.organisation.id}/contract_designs/${designID}`,
    );
    if (resp && !(resp instanceof Error)) {
        contractDesign = resp as ContractDesignWithCode;
        const contractFileName = path.join(SimbaConfig.contractDirectory, `${contractDesign.name}.sol`);
        fs.writeFileSync(contractFileName, Buffer.from(contractDesign.code, 'base64').toString());
        SimbaConfig.log.info(`${chalk.greenBright(`simba: syncing ${contractDesign.name}`)} -> ${contractFileName}`);
    } else {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: error acquiring contract design for ${chalk.greenBright(`${designID}`)}`)}`)
    }
}

