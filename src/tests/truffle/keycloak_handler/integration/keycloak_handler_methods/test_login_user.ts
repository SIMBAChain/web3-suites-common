import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests loginUser, which calls getVerificationInfo', () => {
    it('endpoint returns the posted data', async () => {
        // original settings
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const originalAuthConfig = SimbaConfig.ConfigStore.all;
        const kch = new KeycloakHandler();
        const verificationInfoCompleteURI = await kch.loginUser();
        expect(verificationInfoCompleteURI).to.exist;
        expect((verificationInfoCompleteURI as string).includes("user_code")).to.equal(true);

        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        SimbaConfig.ConfigStore.clear();
        SimbaConfig.ConfigStore.set(originalAuthConfig);
    }).timeout(15000);
});