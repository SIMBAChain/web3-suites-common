import {default as chalk} from 'chalk';
import {SimbaConfig} from '../lib';
import {ContractDesign} from './';

export async function allContracts(): Promise<ContractDesign[] | void> {
    let contractDesigns: ContractDesign[] = [];
    const url = `organisations/${SimbaConfig.organisation.id}/contract_designs/`;
    let resp = await SimbaConfig.authStore.doGetRequest(url);
    if (resp && !(resp instanceof Error)) {
        const res = resp as any;
        contractDesigns = contractDesigns.concat(res.results as ContractDesign[]);
        while (res.next !== null) {
            const q: string = res.next.split('?').pop();
            resp = await SimbaConfig.authStore.doGetRequest(`${url}?${q}`);
            contractDesigns = contractDesigns.concat(res.results as ContractDesign[]);
        }
        return contractDesigns;
    } else {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: error acquiring contract designs for organisation ${chalk.greenBright(`${SimbaConfig.organisation.id}`)}`)}`);
        return;
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
    }
}
