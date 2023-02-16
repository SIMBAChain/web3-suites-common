import {
    SimbaConfig,
} from "../../../../commands/lib/config";
import {
    AzureHandler,
} from "../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('tests getAndSetAZAuthInfo', () => {
    it('authProviderInfo should be present after call', async () => {
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        const az = new AzureHandler();
        SimbaConfig.ProjectConfigStore.delete("authProviderInfo");
        expect(SimbaConfig.ProjectConfigStore.get("authProviderInfo")).to.not.exist;
        await az.setAndGetAZAuthInfo();
        // we changed the dev environment to keycloak
        expect(SimbaConfig.ProjectConfigStore.get("authProviderInfo").type).to.equal("keycloak");
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
    }).timeout(10000);
});
