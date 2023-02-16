import {
    SimbaConfig,
} from "../../../../src/commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../src/commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests authStore', () => {
    it('authStore should be instance of KeycloakHandler since using dev environment', async () => {
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        SimbaConfig.ProjectConfigStore.delete("authProviderInfo")
        const authStore = await SimbaConfig.authStore();
        const isKeycloakHandler = (authStore instanceof KeycloakHandler);
        expect(isKeycloakHandler).to.equal(true);
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
    }).timeout(20000);
});