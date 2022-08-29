import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests refreshToken with new authToken', () => {
    it('authtoken should stay the same, since it is new', async () => {
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
        let firstAuthToken = kch.getConfig("SIMBAAUTH");
        const firstAccessToken = firstAuthToken.access_token;
        
        // posterior
        expect(firstAuthToken).to.exist;

        // function
        // we should grab a new auth token when we have a client
        // creds token here:
        await kch.refreshToken();

        // posterior
        let secondAuthToken = kch.getConfig("SIMBAAUTH");
        const secondAccessToken = secondAuthToken.access_token;
        expect(firstAccessToken).to.not.equal(secondAccessToken);

        // function
        kch.logout();
        
        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(15000);
});


