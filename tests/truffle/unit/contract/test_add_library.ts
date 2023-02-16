import {
    SimbaConfig,
} from "../../../../src/commands/lib/config";
import {
    addLib,
} from "../../../../src/commands/contract";
import { expect } from 'chai';
import 'mocha';


describe('add library test', () => {
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
    }).timeout(10000);
});