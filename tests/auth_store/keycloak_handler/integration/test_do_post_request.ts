import {
    SimbaConfig,
} from "../../../../commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests doPostRequest after login', () => {
    it('returns an error', async () => {
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
        // this needs to be standardized between KeycloakHandler and AzureHandler
        // keycloak is RETURNING error, but azure is THROWING
        // standardize by THROWING in each in future ticket
        const returnedError = await kch.doPostRequest(url, data) as Record<any, any>;
        expect(returnedError.message).to.equal("Request failed with status code 400");

        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(15000);
});