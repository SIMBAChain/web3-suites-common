import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    AzureHandler,
} from "../../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests doGetRequest after login', () => {
    it('should get back a list of orgs', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const az = new AzureHandler();
        await az.performLogin(false);
        const url = 'organisations/';
        
        // function
        const res = await az.doGetRequest(url);
        expect(res.count).to.be.greaterThan(0);

        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(100000);
});
