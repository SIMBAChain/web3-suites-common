import {
    SimbaConfig,
} from "../../../../src/commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../src/commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests doPostRequest, with free post endpoint', () => {
    it('free test post endpoint returns data sent', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const kch = new KeycloakHandler();
        await kch.performLogin(false);
        const url = "https://httpbin.org/post";
        const data = {
            user: "brendan.birch@simbachain.com",
            solution_blocks: {},
            organisation_name: "brendan_birch_simbachain_com",
            role: "Owner",
        };

        const res = await kch.doPostRequest(url, data) as Record<any, any>;
        expect(JSON.parse(res.data).user).to.equal(data.user)

        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(15000);
});