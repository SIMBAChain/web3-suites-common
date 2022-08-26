import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests doPostRequest after login', () => {
    it('endpoint returns the posted data', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const kch = new KeycloakHandler();
        await kch.performLogin(false);
        const url = "https://simba-demo-api.platform.simbachain.com/admin/users/organisation/add/";
        const data = {
            user: "brendan.birch@simbachain.com",
            solution_blocks: {},
            organisation_name: "brendan_birch_simbachain_com",
            role: "Owner",
        };
        // function
        // calling with the above data will not change anything for this user
        // since they are already an owner
        const res = await kch.doPostRequest(url, data) as Record<any, any>;
        expect(res.organisation_name).to.equal(data.organisation_name)

        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(100000);
});