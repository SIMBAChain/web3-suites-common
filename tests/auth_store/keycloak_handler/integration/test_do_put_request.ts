import {
    SimbaConfig,
} from "../../../../src/commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../src/commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests doPutRequest after login, using free endpoint', () => {
    it('endpoint returns the posted data', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const kch = new KeycloakHandler();
        await kch.performLogin(false);
        const url = "https://httpbin.org/put";
        const data = {
            default_organisation: "brendan_birch_simbachain_com",
        };
        // function
        // calling with the above data will not change anything for this user
        // since they are already an owner
        const res = await kch.doPutRequest(url, data) as Record<any, any>;
        expect(res.url).to.equal(url)

        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(15000);
});
