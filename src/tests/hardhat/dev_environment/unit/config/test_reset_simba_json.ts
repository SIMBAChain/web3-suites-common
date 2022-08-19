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
    pullMostRecentFromContractName
} from "../../../../../commands/contract";
import {
    printAllContracts,
} from "../../../../../commands/contract/list"
import { expect } from 'chai';
import 'mocha';


describe('resetSimbaJson test', () => { // the tests container
    it('baseURL, web3Suite, and logLevel fields should have their original values after reset', () => {
        // grab full simba.json so we can use it to reset after
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const baseURL = SimbaConfig.ProjectConfigStore.get("baseURL");
        const web3Suite = SimbaConfig.ProjectConfigStore.get("web3Suite");
        const logLevel = SimbaConfig.ProjectConfigStore.get("logLevel") ?
         SimbaConfig.ProjectConfigStore.get("logLevel") :
            "info";
        SimbaConfig.resetSimbaJson(originalSimbaJson, null, true);
        const newBaseURL = SimbaConfig.ProjectConfigStore.get("baseURL");
        const newWeb3Suite = SimbaConfig.ProjectConfigStore.get("web3Suite");
        const newLogLevel = SimbaConfig.ProjectConfigStore.get("logLevel");

        const contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        const currentKeysLength = Object.keys(contractsInfo).length;
        expect(currentKeysLength).to.equal(0);

        expect(newBaseURL).to.equal(baseURL);
        expect(newWeb3Suite).to.equal(web3Suite);
        expect(newLogLevel).to.equal(logLevel);
        // now reset simba.json to its original state
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
    });
    it('contracts_info should have no entries after reset', () => { // the single test
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        SimbaConfig.resetSimbaJson(originalSimbaJson, null, true);
        const contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        const currentKeysLength = Object.keys(contractsInfo).length;
        expect(currentKeysLength).to.equal(0);
        // now reset simba.json to its original state
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
    });
    
});