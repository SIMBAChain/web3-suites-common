import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    KeycloakHandler,
} from "../../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests authStore', () => {
    it('authStore should be instace of KeycloakHandler since using demo environment', async () => {
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        SimbaConfig.ProjectConfigStore.delete("authProviderInfo");
        const authStore = await SimbaConfig.authStore();
        const isKeycloakHandler = (authStore instanceof KeycloakHandler);
        expect(isKeycloakHandler).to.equal(true);
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
    }).timeout(10000);
});