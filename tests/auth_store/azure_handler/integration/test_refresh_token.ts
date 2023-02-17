// import {
//     SimbaConfig,
// } from "../../../../src/commands/lib/config";
// import {
//     AzureHandler,
// } from "../../../../src/commands/lib";
// import { expect } from 'chai';
// import 'mocha';

// describe('tests refreshToken with new authToken', () => {
//     it('authtoken should stay the same, since it is new', async () => {
//         // original settings
//         const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
//         const originalAuthConfig = SimbaConfig.ConfigStore.all;
//         const az = new AzureHandler();

//         // function
//         az.logout();
//         const currentAuthToken = az.getConfig("SIMBAAUTH");
//         let isLoggedIn = az.isLoggedIn();
        
//         // prior
//         expect(currentAuthToken).to.not.exist;
//         expect(isLoggedIn).to.equal(false);

//         // function
//         await az.getAndSetAuthTokenFromClientCreds();
//         let firstAuthToken = az.getConfig("SIMBAAUTH");
//         const firstAccessToken = firstAuthToken.access_token;
        
//         // posterior
//         expect(firstAuthToken).to.exist;
//         isLoggedIn = az.isLoggedIn();
//         expect(isLoggedIn).to.equal(true);

//         // function
//         // should not change auth token, since it is new
//         await az.refreshToken();

//         // posterior
//         let secondAuthToken = az.getConfig("SIMBAAUTH");
//         const secondAccessToken = secondAuthToken.access_token;
//         expect(firstAccessToken).to.equal(secondAccessToken);

//         // function
//         az.logout();
        
//         // resetting
//         SimbaConfig.ProjectConfigStore.clear();
//         SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
//         SimbaConfig.ConfigStore.clear();
//         SimbaConfig.ConfigStore.set(originalAuthConfig);
//     }).timeout(15000);
// });

// describe('tests refreshToken with synthetically old authToken', () => {
//     it('authtoken should change, since we are modifying it to an older date', async () => {
//         // original settings
//         const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
//         const originalAuthConfig = SimbaConfig.ConfigStore.all;
//         const az = new AzureHandler();

//         // function
//         az.logout();
//         const currentAuthToken = az.getConfig("SIMBAAUTH");
//         let isLoggedIn = az.isLoggedIn();
        
//         // prior
//         expect(currentAuthToken).to.not.exist;
//         expect(isLoggedIn).to.equal(false);

//         // function
//         await az.getAndSetAuthTokenFromClientCreds();
//         let firstAuthToken = az.getConfig("SIMBAAUTH");
//         const firstAccessToken = firstAuthToken.access_token;
//         const firstExpiresAt = firstAuthToken.expires_at;
//         let synthExpiresAt = firstExpiresAt;
//         synthExpiresAt = firstExpiresAt.split("-");
//         // setting older expires_at year
//         synthExpiresAt[0] = "2020";
//         synthExpiresAt = synthExpiresAt.join("-");
//         firstAuthToken.expires_at = synthExpiresAt;

//         // set synth old authtoken
//         await az.setConfig("SIMBAAUTH", firstAuthToken);
        
//         // posterior
//         expect(firstAuthToken).to.exist;
//         isLoggedIn = az.isLoggedIn();
//         expect(isLoggedIn).to.equal(true);
//         expect(new Date(synthExpiresAt)).to.be.lessThan(new Date());

//         // function
//         // should set new auth token, since it's synthetically old
//         await az.refreshToken();

//         // posterior
//         let secondAuthToken = az.getConfig("SIMBAAUTH");
//         const secondAccessToken = secondAuthToken.access_token;
//         expect(firstAccessToken).to.not.equal(secondAccessToken);

//         // function
//         az.logout();
        
//         // resetting
//         SimbaConfig.ProjectConfigStore.clear();
//         SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
//         SimbaConfig.ConfigStore.clear();
//         SimbaConfig.ConfigStore.set(originalAuthConfig);
//     }).timeout(15000);
// });

// describe('tests refreshToken with forced reset', () => {
//     it('authtoken should change, since we are forcing reset', async () => {
//         // original settings
//         const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
//         const originalAuthConfig = SimbaConfig.ConfigStore.all;
//         const az = new AzureHandler();

//         // function
//         az.logout();
//         const currentAuthToken = az.getConfig("SIMBAAUTH");
//         let isLoggedIn = az.isLoggedIn();
        
//         // prior
//         expect(currentAuthToken).to.not.exist;
//         expect(isLoggedIn).to.equal(false);

//         // function
//         await az.getAndSetAuthTokenFromClientCreds();
//         let firstAuthToken = az.getConfig("SIMBAAUTH");
//         const firstAccessToken = firstAuthToken.access_token;
        
//         // posterior
//         expect(firstAuthToken).to.exist;
//         isLoggedIn = az.isLoggedIn();
//         expect(isLoggedIn).to.equal(true);

//         // function
//         // should not change auth token, since it is new
//         await az.refreshToken(true);

//         // posterior
//         let secondAuthToken = az.getConfig("SIMBAAUTH");
//         const secondAccessToken = secondAuthToken.access_token;
//         expect(firstAccessToken).to.not.equal(secondAccessToken);

//         // function
//         az.logout();
        
//         // resetting
//         SimbaConfig.ProjectConfigStore.clear();
//         SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
//         SimbaConfig.ConfigStore.clear();
//         SimbaConfig.ConfigStore.set(originalAuthConfig);
//     }).timeout(15000);
// });
