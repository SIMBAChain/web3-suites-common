import {
    SimbaConfig,
} from "../../../../commands/lib/config";
import {
    AzureHandler,
} from "../../../../commands/lib/authentication";
import {
    pullContractsInteractive,
    pullAllMostRecentContracts,
    pullAllMostRecentSolFilesAndSourceCode,
    pullMostRecentRecentSolFileFromContractName,
    pullMostRecentFromContractName
} from "../../../../commands/contract";
import {
    printAllContracts,
} from "../../../../commands/contract/list"
import { expect } from 'chai';
import 'mocha';


describe('resetSimbaJson test', () => { // the tests container
    it('baseURL, web3Suite, and logLevel fields should have their original values after reset', () => {
        // grab full simba.json so we can use it to reset after
        const simbaJson = SimbaConfig.ProjectConfigStore.all;
        const baseURL = SimbaConfig.ProjectConfigStore.get("baseURL");
        const web3Suite = SimbaConfig.ProjectConfigStore.get("web3Suite");
        const logLevel = SimbaConfig.ProjectConfigStore.get("logLevel") ?
            SimbaConfig.ProjectConfigStore.get("logLevel") :
            "info";
        SimbaConfig.resetSimbaJson();
        const newBaseURL = SimbaConfig.ProjectConfigStore.get("baseURL");
        const newWeb3Suite = SimbaConfig.ProjectConfigStore.get("web3Suite");
        const newLogLevel = SimbaConfig.ProjectConfigStore.get("logLevel");
        expect(newBaseURL).to.equal(baseURL);
        expect(newWeb3Suite).to.equal(web3Suite);
        expect(newLogLevel).to.equal(logLevel);
        // now reset simba.json to its original state
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(simbaJson);
    });
    it('keys length should be 3, since we get rid of all other fields', () => { // the single test
        const simbaJson = SimbaConfig.ProjectConfigStore.all;
        SimbaConfig.resetSimbaJson();
        const newSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const numKeys = Object.keys(newSimbaJson).length;
        expect(numKeys).to.equal(3);
        // now reset simba.json to its original state
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(simbaJson);
    });
});