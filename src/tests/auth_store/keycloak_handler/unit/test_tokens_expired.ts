import {
    SimbaConfig,
} from "../../../../commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

const oldAuthToken = {
    "access_token": "fake",
    "expires_in": 300,
    "refresh_expires_in": 1800,
    "refresh_token": "fake",
    "token_type": "Bearer",
    "not-before-policy": 0,
    "session_state": "e73bdc0a-25e2-4755-bd4a-ea7ff1849360",
    "scope": "email profile",
    "retrieved_at": "2020-08-27T21:17:24.726Z",
    "expires_at": "2020-08-27T21:22:24.726Z",
    "refresh_expires_at": "2020-08-27T21:47:24.726Z"
}

const newAuthToken = {
    "access_token": "fake",
    "expires_in": 300,
    "refresh_expires_in": 1800,
    "refresh_token": "fake",
    "token_type": "Bearer",
    "not-before-policy": 0,
    "session_state": "e73bdc0a-25e2-4755-bd4a-ea7ff1849360",
    "scope": "email profile",
    "retrieved_at": "2030-08-27T21:17:24.726Z",
    "expires_at": "2030-08-27T21:22:24.726Z",
    "refresh_expires_at": "2030-08-27T21:47:24.726Z"
}

describe('tests tokenExpired', () => {
    it('should return true, false', async () => {
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
        await kch.setConfig("SIMBAAUTH", oldAuthToken);

        // posterior
        let tokenIsExpired = kch.tokenExpired();
        expect(tokenIsExpired).to.equal(true);

        await kch.setConfig("SIMBAAUTH", newAuthToken);

        // posterior
        tokenIsExpired = kch.tokenExpired();
        expect(tokenIsExpired).to.equal(false);

        
        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(10000);
});

describe('tests refreshTokenExpired', () => {
    it('should return true, false', async () => {
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
        await kch.setConfig("SIMBAAUTH", oldAuthToken);

        // posterior
        let tokenIsExpired = kch.refreshTokenExpired();
        expect(tokenIsExpired).to.equal(true);

        await kch.setConfig("SIMBAAUTH", newAuthToken);

        // postterior
        tokenIsExpired = kch.refreshTokenExpired();
        expect(tokenIsExpired).to.equal(false);
        
        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(10000);
});