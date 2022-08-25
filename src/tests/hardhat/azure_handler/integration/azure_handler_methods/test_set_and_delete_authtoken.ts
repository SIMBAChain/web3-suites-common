import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    AzureHandler,
} from "../../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests performLogin with non-interactive login', () => {
    it('authtoken should be present after calling performLogin', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const az = new AzureHandler();

        // function
        az.logout();
        const currentAuthToken = az.getConfig("SIMBAAUTH");
        let isLoggedIn = az.isLoggedIn();
        
        // prior
        expect(currentAuthToken).to.not.exist;
        expect(isLoggedIn).to.equal(false);

        // function
        await az.performLogin(false);
        let newAuthToken = az.getConfig("SIMBAAUTH");
        
        // posterior
        expect(newAuthToken).to.exist;
        isLoggedIn = az.isLoggedIn();
        expect(isLoggedIn).to.equal(true);

        // function
        az.logout();
        newAuthToken = az.getConfig("SIMBAAUTH");

        // posterior
        expect(newAuthToken).to.not.exist;
        isLoggedIn = az.isLoggedIn();
        expect(isLoggedIn).to.equal(false);
        
        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(10000);
});