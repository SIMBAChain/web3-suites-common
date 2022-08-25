import {
    SimbaConfig,
    EnvVariableKeys,
} from "../../../../../commands/lib/config";
import { expect } from 'chai';
import 'mocha';

describe('tests retrieveEnvVar', () => {
    it('vals from retrieveEnvVar should be same as from process.env', async () => {
        const IDFromMethod = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.ID);
        const IDFromEnv = process.env.SIMBA_AZURE_ID;
        expect(IDFromMethod).to.equal(IDFromEnv);

        const secretFromMethod = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.SECRET);
        const secretFromEnv = process.env.SIMBA_AZURE_SECRET;
        expect(secretFromMethod).to.equal(secretFromEnv);

        const authEndpointFromMethod = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.AUTHENDPOINT);
        const authEndpointFromEnv = process.env.SIMBA_AUTH_CLIENT_ENDPOINT;
        expect(authEndpointFromMethod).to.equal(authEndpointFromEnv);
    });
});