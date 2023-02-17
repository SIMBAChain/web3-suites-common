// import {
//     SimbaConfig,
// } from "../../../../commands/lib/config";
// import {
//     AzureHandler,
// } from "../../../../commands/lib";
// import { expect } from 'chai';
// import 'mocha';

// describe('tests doPutRequest after login', () => {
//     it('endpoint returns the posted data', async () => {
//         // original settings
//         const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
//         const originalAuthConfig = SimbaConfig.ConfigStore.all;
//         const az = new AzureHandler();
//         await az.performLogin(false);
//         const url = "https://simba-dev-api.platform.simbachain.com/user/default_organisation/";
//         const data = {
//             default_organisation: "brendan_birch_simbachain_com",
//         };
//         // function
//         // calling with the above data will not change anything for this user
//         // since they are already an owner
//         const res = await az.doPutRequest(url, data);
//         expect(res.default_organisation).to.equal(data.default_organisation)

//         // resetting
//         SimbaConfig.ProjectConfigStore.clear();
//         SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
//         SimbaConfig.ConfigStore.clear();
//         SimbaConfig.ConfigStore.set(originalAuthConfig);
//     }).timeout(15000);
// });
