import {
    SimbaConfig,
    EnvVariableKeys,
} from "../../../../src/commands/lib/config";
import { expect } from 'chai';
import 'mocha';

describe('tests setEnvVars', () => {
    it('SimbaConfig.envVars should be present after calling .setEnvVars', async () => {
        // for this test, you need to have env vars set for:
            // SIMBA_KEYCLOAK_ID
            // SIMBA_KEYCLOAK_SECRET
        SimbaConfig.envVars = {};
        await SimbaConfig.setEnvVars();
        const envVars = SimbaConfig.envVars;
        // following two tests ensure .envVars was both set and returned
        expect(Object.values(envVars).length).to.be.greaterThan(0);
        expect(Object.values(SimbaConfig.envVars).length).to.be.greaterThan(0);
    }).timeout(10000);

    it('SimbaConfig.envVars should be present after calling .retrieveEnvVar()', async () => {
        // for this test, you need to have env vars set for:
            // SIMBA_KEYCLOAK_ID
            // SIMBA_KEYCLOAK_SECRET
        SimbaConfig.envVars = {};
        const id = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.ID);
        const envVars = SimbaConfig.envVars;
        // following two tests ensure .envVars was both set and returned
        expect(Object.values(envVars).length).to.be.greaterThan(0);
        expect(Object.values(SimbaConfig.envVars).length).to.be.greaterThan(0);
    }).timeout(10000);
});