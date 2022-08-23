// import {
//     SimbaConfig,
// } from "../../../../../commands/lib/config";
// import {
//     AzureHandler,
// } from "../../../../../commands/lib/authentication";
// import {
//     allContracts,
// } from "../../../../../commands/contract/list";
// import { expect } from 'chai';
// import 'mocha';

// describe('testing gathering all contracts', () => {
//     it('first entry of results should contain "id" and "name" properties', async () => {
//         const simbaConfig = new SimbaConfig();
//         const authStore = await simbaConfig.authStore();
//         if (authStore instanceof AzureHandler) {
//             await authStore.performLogin(false);
//             const contracts: any = await allContracts();
//             // just a couple lines to make sure we're getting back the right kind of info
//             expect("id" in contracts[0]).to.equal(true);
//             expect("name" in contracts[0]).to.equal(true);
//         }
//     }).timeout(100000);
// });
