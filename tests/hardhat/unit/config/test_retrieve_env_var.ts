import {
    SimbaConfig,
    EnvVariableKeys,
} from "../../../../src/commands/lib/config";
import { expect } from 'chai';
import 'mocha';

describe('tests retrieveEnvVar', () => {
    it('vals from retrieveEnvVar should be same as from process.env', async () => {
        // for this test, you need to have env vars set for:
            // SIMBA_AUTH_CLIENT_ID
            // SIMBA_AUTH_CLIENT_SECRET
        const IDFromMethod = SimbaConfig.retrieveEnvVar(EnvVariableKeys.ID);
        // dev is now using keycloak
        const IDFromEnv = process.env.SIMBA_AUTH_CLIENT_ID;
        expect(IDFromMethod).to.equal(IDFromEnv);

        const secretFromMethod = SimbaConfig.retrieveEnvVar(EnvVariableKeys.SECRET);
        const secretFromEnv = process.env.SIMBA_AUTH_CLIENT_SECRET;
        expect(secretFromMethod).to.equal(secretFromEnv);

    }).timeout(20000);
});