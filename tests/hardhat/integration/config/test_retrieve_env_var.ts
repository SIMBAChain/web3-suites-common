import {
    SimbaConfig,
    EnvVariableKeys,
} from "../../../../src/commands/lib/config";
import { expect } from 'chai';
import 'mocha';

describe('tests retrieveEnvVar', () => {
    it('vals from retrieveEnvVar should be same as from process.env', async () => {
        // for this test, you need to have env vars set for:
            // SIMBA_AZURE_ID
            // SIMBA_AZURE_SECRET
        const IDFromMethod = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.ID);
        // dev is now using keycloak
        const IDFromEnv = process.env.SIMBA_KEYCLOAK_ID;
        expect(IDFromMethod).to.equal(IDFromEnv);

        const secretFromMethod = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.SECRET);
        const secretFromEnv = process.env.SIMBA_KEYCLOAK_SECRET;
        expect(secretFromMethod).to.equal(secretFromEnv);

        const authEndpointFromMethod = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.AUTHENDPOINT);
        const authEndpointFromEnv = process.env.SIMBA_AUTH_CLIENT_ENDPOINT;
        expect(authEndpointFromMethod).to.equal(authEndpointFromEnv);
    }).timeout(20000);
});