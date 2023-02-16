import {
    SimbaConfig,
} from "../../../../commands/lib/config";
import {
    getBlockchains,
    getStorages,
} from "../../../../commands/lib";
import { expect } from 'chai';
import 'mocha';

describe('test getBlockchains', () => {
    it('result should exist', async () => {
        const authStore = await SimbaConfig.authStore();
        await authStore!.performLogin(false);
        const blockChains = await getBlockchains(new SimbaConfig());
        expect(blockChains).to.exist;
    }).timeout(30000);
});

describe('test getStorages', () => {
    it('result should exist', async () => {
        const authStore = await SimbaConfig.authStore();
        await authStore!.performLogin(false);
        const storages = await getStorages(new SimbaConfig())
        expect(storages).to.exist;
    }).timeout(30000);
});