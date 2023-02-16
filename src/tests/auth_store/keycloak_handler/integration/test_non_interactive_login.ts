import {
    SimbaConfig,
} from "../../../../commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

// These tests test non-interactive login
// perfomLogin(false) contains pretty much all of the functionality
// that the others do, but we're testing them separately as well here

describe('tests performLogin with non-interactive login', () => {
    it('authtoken should be present after calling performLogin', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const kch = new KeycloakHandler();

        // function
        kch.logout();
        const currentAuthToken = kch.getConfig("SIMBAAUTH");
        let isLoggedIn = kch.isLoggedIn();
        
        // prior
        expect(currentAuthToken).to.not.exist;
        expect(isLoggedIn).to.equal(false);

        // function
        await kch.performLogin(false);
        let newAuthToken = kch.getConfig("SIMBAAUTH");
        
        // posterior
        expect(newAuthToken).to.exist;

        // function
        kch.logout();
        newAuthToken = kch.getConfig("SIMBAAUTH");

        // posterior
        expect(newAuthToken).to.not.exist;
        isLoggedIn = kch.isLoggedIn();
        expect(isLoggedIn).to.equal(false);
        
        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(10000);
});

describe('tests loginAndGetAuthToken with non-interactive login', () => {
    it('authtoken should be present after calling performLogin', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const kch = new KeycloakHandler();

        // function
        kch.logout();
        const currentAuthToken = kch.getConfig("SIMBAAUTH");
        
        // prior
        expect(currentAuthToken).to.not.exist;

        // function
        await kch.performLogin(false);
        let newAuthToken = kch.getConfig("SIMBAAUTH");

        // function
        kch.logout();
        newAuthToken = kch.getConfig("SIMBAAUTH");

        // posterior
        expect(newAuthToken).to.not.exist;
        
        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(10000);
});

describe('tests getAndSetAuthTokenFromClientCreds', () => {
    it('authtoken should be present after calling', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const kch = new KeycloakHandler();

        // function
        kch.logout();
        const currentAuthToken = kch.getConfig("SIMBAAUTH");
        
        // prior
        expect(currentAuthToken).to.not.exist;

        // function
        await kch.getAndSetAuthTokenFromClientCreds();
        let newAuthToken = kch.getConfig("SIMBAAUTH");
        expect(newAuthToken).to.exist;

        // posterior
        kch.logout();
        newAuthToken = kch.getConfig("SIMBAAUTH");
        expect(newAuthToken).to.not.exist;
        
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(10000);
});