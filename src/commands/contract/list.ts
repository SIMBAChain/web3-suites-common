import {default as chalk} from 'chalk';
import {SimbaConfig} from '../lib';
import {ContractDesign} from './';

export async function allContracts(): Promise<ContractDesign[] | Error> {
    SimbaConfig.log.debug(`:: ENTER :`);
    let contractDesigns: ContractDesign[] = [];
    const url = `organisations/${SimbaConfig.organisation.id}/contract_designs/`;
    let resp = await SimbaConfig.authStore.doGetRequest(url);
    SimbaConfig.log.debug(`resp: ${JSON.stringify(resp)}`);
    if (resp && !(resp instanceof Error)) {
        SimbaConfig.log.debug(`resp is not ERROR`);
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: retrieving all contracts for organisation ${SimbaConfig.organisation.name}`)}`);
        let res = resp as any;
        contractDesigns = contractDesigns.concat(res.results as ContractDesign[]);
        while (res.next !== null) {
            const q: string = res.next.split('?').pop();
            SimbaConfig.log.debug(`\nsimba: retrieving contract ${JSON.stringify(q)}`);
            res = await SimbaConfig.authStore.doGetRequest(`${url}?${q}`);
            contractDesigns = contractDesigns.concat(res.results as ContractDesign[]);
        }
        SimbaConfig.log.debug(`contractDesigns: ${JSON.stringify(contractDesigns)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return contractDesigns;
    } else {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: error acquiring contract designs for organisation ${chalk.greenBright(`${SimbaConfig.organisation.id}`)}`)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return new Error(`\nsimba: error acquiring contract designs for organisation`);
    }
}

export async function printAllContracts(): Promise<void> {
    let contractDesigns: ContractDesign[];
    const _allContracts = await allContracts();
    if (_allContracts && !(_allContracts instanceof Error)) {
        contractDesigns = _allContracts;
        for (let i = 0; i < contractDesigns.length - 1; i++) {
            SimbaConfig.log.info(
                `${chalk.green(contractDesigns[i].name)}\n\tversion ${contractDesigns[i].version}\n\tid ${
                    contractDesigns[i].id
                }`,
            );
        }
    } else {
        SimbaConfig.log.error(`\nsimba: error obtaining contracts`);
    }
}
