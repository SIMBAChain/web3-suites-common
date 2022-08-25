// import {
//     SimbaConfig,
// } from "../../../../../commands/lib/config";
// import {
//     AzureHandler,
// } from "../../../../../commands/lib";
// import { expect } from 'chai';
// import 'mocha';

// describe('tests getClientOptions with url not beginning in http', () => {
//     it('should get back body with uri, headers, json. new uri should be prepended with baseURI', async () => {
//         // original settings
//         const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
//         const originalAuthConfig = SimbaConfig.ConfigStore.all;
//         const az = new AzureHandler();

//         // function
//         // url not starting in http
//         let url = "simba.com";
//         const opts = await az.getClientOptions(url);
//         expect(opts.uri.startsWith("https://simba-dev-api.platform.simbachain.com")).to.equal(true);
//         expect(opts.headers).to.exist;
//         expect(opts.json).to.equal(true);
        
//         // resetting
//         SimbaConfig.ProjectConfigStore.clear();
//         SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
//         SimbaConfig.ConfigStore.clear();
//         SimbaConfig.ConfigStore.set(originalAuthConfig);
//     }).timeout(10000);
// });

// describe('tests getClientOptions with data, url starting with http', () => {
//     it('should get back body with uri, headers, json. new uri should be prepended with baseURI', async () => {
//         // original settings
//         const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
//         const originalAuthConfig = SimbaConfig.ConfigStore.all;
//         const az = new AzureHandler();

//         // function
//         // url not starting in http
//         let url = "https://simba.com";
//         const data = {
//             fakeKey: "fakeValue",
//         }
//         const opts = await az.getClientOptions(url, "application/json", data);
//         expect(opts.uri).to.equal(url);
//         expect(opts.headers).to.exist;
//         expect(opts.json).to.equal(true);
//         expect(opts.body).to.equal(data);
        
//         // resetting
//         SimbaConfig.ProjectConfigStore.clear();
//         SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
//         SimbaConfig.ConfigStore.clear();
//         SimbaConfig.ConfigStore.set(originalAuthConfig);
//     }).timeout(10000);
// });