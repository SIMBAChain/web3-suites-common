import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    getBlockchains,
    getStorages,
} from "../../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('test getBlockchains', () => {
    it('result should exist', async () => {
        const authStore = await SimbaConfig.authStore();
        await authStore!.performLogin(false);
        const config = new SimbaConfig();
        const blockChains = await getBlockchains(
            config,
            `/v2/organisations/${config.organisation.id}/blockchains/`,
            );
        expect(blockChains).to.exist;
    }).timeout(30000);
});

describe('test getStorages', () => {
    it('result should exist', async () => {
        const authStore = await SimbaConfig.authStore();
        await authStore!.performLogin(false);
        const config = new SimbaConfig();
        const storages = await getStorages(
            config,
            `v2/organisations/${config.organisation.id}/storage/`
        );
        expect(storages).to.exist;
    }).timeout(30000);
});