import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    AzureHandler,
} from "../../../../../commands/lib/authentication";
import {
    pullContractsInteractive,
    pullAllMostRecentContracts,
    pullAllMostRecentSolFilesAndSourceCode,
    pullMostRecentRecentSolFileFromContractName,
    pullMostRecentFromContractName,
    addLib,
    SourceCodeComparer,
} from "../../../../../commands/contract";
import {
    allContracts,
    printAllContracts,
} from "../../../../../commands/contract/list";
import {default as chalk} from 'chalk';
import { expect } from 'chai';
import 'mocha';

describe('testing gathering all contracts', () => { // the tests container
    it('first entry of results should contain "id" and "name" properties', async () => {
        const simbaConfig = new SimbaConfig();
        const authStore = await simbaConfig.authStore();
        if (authStore instanceof AzureHandler) {
            await authStore.performLogin(false);
            const contracts: any = await allContracts();
            if (contracts) {
                if (contracts.length) {
                    // just a couple lines to make sure we're getting back the right kind of info
                    expect("id" in contracts[0]).to.equal(true);
                    expect("name" in contracts[0]).to.equal(true);
                }
            }
        }
    }).timeout(100000);
});
