// import {
//     SimbaConfig,
// } from "../../../../../commands/lib/config";
// import {
//     AzureHandler,
// } from "../../../../../commands/lib";
// import { expect } from 'chai';
// import 'mocha';

// describe('tests authStore', () => {
//     it('authStore should be instace of AzureHandler since using dev environment', async () => {
//         const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
//         SimbaConfig.ProjectConfigStore.delete("authProviderInfo")
//         const authStore = await SimbaConfig.authStore();
//         const isAzureHandler = (authStore instanceof AzureHandler);
//         expect(isAzureHandler).to.equal(true);
//         SimbaConfig.ProjectConfigStore.clear();
//         SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
//     });
// });