import {
    SimbaConfig,
} from "../../../../src/commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../src/commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests doDeleteRequest, using free endpoint', () => {
    it('url should exist in the response', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const kch = new KeycloakHandler();
        await kch.performLogin(false);
        const url = 'https://httpbin.org/delete';
        
        // function
        const res = await kch.doDeleteRequest(url) as Record<any, any>;
        expect(res.url).to.equal(url);

        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(15000);
});
