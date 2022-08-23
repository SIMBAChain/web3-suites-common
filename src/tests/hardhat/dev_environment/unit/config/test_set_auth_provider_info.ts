import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import { expect } from 'chai';
import 'mocha';


describe('tests getAndSetAuthProviderInfo', () => {
    it('authProviderInfo should exist in simba.json after call', async () => {
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        SimbaConfig.ProjectConfigStore.delete("authProviderInfo")
        const returnedAuthInfo = await SimbaConfig.setAndGetAuthProviderInfo();
        const authInfo = SimbaConfig.ProjectConfigStore.get("authProviderInfo");
        expect(authInfo).to.exist;
        expect(authInfo.client_id).to.equal(returnedAuthInfo.client_id);
        // now reset simba.json to its original state
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
    });
});