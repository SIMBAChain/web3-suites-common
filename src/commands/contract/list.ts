import {default as chalk} from 'chalk';
import {SimbaConfig} from '../lib';
import {ContractDesignWithCode} from '.';
import {
    authErrors,
} from "../lib/authentication";

/**
 * Returns data on contract name, version, and design_id
 * @returns {Promise<ContractDesignWithCode[] | void>}
 */
export async function allContracts(): Promise<ContractDesignWithCode[] | void> {
    SimbaConfig.log.debug(`:: ENTER :`);
    let contractDesigns: ContractDesignWithCode[] = [];
    const url = `v2/organisations/${SimbaConfig.organisation.id}/contract_designs/`;
    const authStore = await SimbaConfig.authStore();
    if (authStore) {
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: retrieving all contracts for organisation ${chalk.greenBright(`${SimbaConfig.organisation.name}`)}`)}`);
        let resp = await authStore.doGetRequest(url);
        SimbaConfig.log.debug(`resp: ${JSON.stringify(resp)}`);
        if (resp) {
            let res = resp as any;
            contractDesigns = contractDesigns.concat(res.results as ContractDesignWithCode[]);
            while (res.next !== null) {
                const q: string = res.next.split('?').pop();
                SimbaConfig.log.debug(`\nsimba: retrieving contract ${JSON.stringify(q)}`);
                res = await authStore.doGetRequest(`${url}?${q}`);
                contractDesigns = contractDesigns.concat(res.results as ContractDesignWithCode[]);
            }
            SimbaConfig.log.debug(`contractDesigns: ${JSON.stringify(contractDesigns)}`);
            SimbaConfig.log.debug(`:: EXIT :`);
            return contractDesigns;
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: error acquiring contract designs for organisation ${chalk.greenBright(`${SimbaConfig.organisation.id}`)}`)}`);
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
    } else {
        SimbaConfig.log.error(authErrors.badAuthProviderInfo);
        return;
    }
}

/**
 * Prints data on contract name, version, and design_id
 */
export async function printAllContracts(): Promise<void> {
    let contractDesigns: ContractDesignWithCode[];
    const _allContracts = await allContracts();
    if (_allContracts) {
        contractDesigns = _allContracts;
        for (let i = 0; i < contractDesigns.length; i++) {
            SimbaConfig.log.info(
                `\n\t${chalk.green(contractDesigns[i].name)}\n\tversion ${contractDesigns[i].version}\n\tid ${
                    contractDesigns[i].id}\n\tcreated_on ${contractDesigns[i].created_on}\n\tupdated_on ${contractDesigns[i].updated_on}`,
            );
        }
    } else {
        SimbaConfig.log.error(`\nsimba: error obtaining contracts`);
    }
}
