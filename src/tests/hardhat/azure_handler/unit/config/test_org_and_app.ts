import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import { expect } from 'chai';
import 'mocha';
import * as path from 'path';
import {cwd} from 'process';

describe('tests web3Suite', () => {
    it('should be "hardhat"', async () => {
        const web3Suite = SimbaConfig.web3Suite;
        expect(web3Suite.toLowerCase()).to.equal("hardhat");
    }).timeout(10000);
});

describe('tests organisation', () => {
    it('should be "brendan_birch_simbachain_com', async () => {
        // getter
        const oldOrg = SimbaConfig.organisation;
        expect(oldOrg.name).to.equal("brendan_birch_simbachain_com");
        SimbaConfig.ProjectConfigStore.delete("organisation")
        expect(SimbaConfig.ProjectConfigStore.get("organisation")).to.not.exist;
        // setter
        SimbaConfig.organisation = oldOrg;
        expect(SimbaConfig.ProjectConfigStore.get("organisation").name).to.equal("brendan_birch_simbachain_com");
    }).timeout(10000);
});

describe('tests application', () => {
    it('should be "BrendanTestApp', async () => {
        // getter
        const oldApp = SimbaConfig.application;
        expect(oldApp.name).to.equal("BrendanTestApp");
        SimbaConfig.ProjectConfigStore.delete("application")
        expect(SimbaConfig.ProjectConfigStore.get("application")).to.not.exist;
        // setter
        SimbaConfig.application = oldApp;
        expect(SimbaConfig.ProjectConfigStore.get("application").name).to.equal("BrendanTestApp");
    }).timeout(10000);
});