// import {
//     SimbaConfig,
// } from "../../../../commands/lib/config";
// import {
//     AzureHandler,
// } from "../../../../commands/lib";
// import { expect } from 'chai';
// import 'mocha';

// describe('tests doPostRequest after login', () => {
//     it('endpoint returns the posted data', async () => {
//         // original settings
//         const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
//         const originalAuthConfig = SimbaConfig.ConfigStore.all;
//         const az = new AzureHandler();
//         await az.performLogin(false);
//         const url = "https://simba-dev-api.platform.simbachain.com/admin/users/organisation/add/";
//         const data = {
//             user: "brendan.birch@simbachain.com",
//             solution_blocks: {},
//             organisation_name: "brendan_birch_simbachain_com",
//             role: "Owner",
//         };
//         // this needs to be standardized between KeycloakHandler and AzureHandler
//         // keycloak is RETURNING error, but azure is THROWING
//         // standardize by THROWING in each in future ticket
//         try {
//             await az.doPostRequest(url, data);
//         } catch (err) {
//             expect(err.message).to.equal("Request failed with status code 400");
//         }

//         // resetting
//         SimbaConfig.ProjectConfigStore.clear();
//         SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
//         SimbaConfig.ConfigStore.clear();
//         SimbaConfig.ConfigStore.set(originalAuthConfig);
//     }).timeout(15000);
// });