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
} from "../../../../../commands/contract";
import {
    printAllContracts,
} from "../../../../../commands/contract/list"
import { expect } from 'chai';
import 'mocha';


describe('add library test', () => { // the tests container
    it('should be 0x', async () => {
        // grab full simba.json so we can use it to reset after
        const simbaJson = SimbaConfig.ProjectConfigStore.all;
        const libName = "simbaLib";
        const libAddress = "0x";
        await addLib(libName, libAddress);
        const libraryAddresses = SimbaConfig.ProjectConfigStore.get("library_addresses");
        const addressInSimbaJson = libraryAddresses[libName];
        expect(addressInSimbaJson).to.equal(libAddress);
        // now reset simba.json to its original state
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(simbaJson);
    });
});