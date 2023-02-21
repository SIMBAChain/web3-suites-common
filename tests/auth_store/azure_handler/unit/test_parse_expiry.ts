// import {
//     AzureHandler,
// } from "../../../../commands/lib";
// import { expect } from 'chai';
// import 'mocha';

// const authToken = {
//     "access_token": "fake",
//     "expires_in": 300,
//     "refresh_expires_in": 1800,
//     "refresh_token": "fake",
//     "token_type": "Bearer",
//     "not-before-policy": 0,
//     "session_state": "e73bdc0a-25e2-4755-bd4a-ea7ff1849360",
//     "scope": "email profile",
// }

// describe('tests parseExpiry', () => {
//     it('parsed "at" fields should exist on new token', async () => {
//         const az = new AzureHandler();
//         const parsed = az.parseExpiry(authToken);
//         expect(parsed.expires_at).to.exist;
//         expect(parsed.refresh_expires_at).to.exist;
//         expect(parsed.retrieved_at).to.exist;
//     }).timeout(10000);
// });