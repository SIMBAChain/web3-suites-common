import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import { expect } from 'chai';
import 'mocha';

describe('tests web3Suite', () => {
    it('should be "hardhat"', async () => {
        const web3Suite = SimbaConfig.web3Suite;
        expect(web3Suite.toLowerCase()).to.equal("hardhat");
    }).timeout(10000);
});

describe('tests logLevel', () => {
    it('should be "info" then "debug"', async () => {
        const oldLogLevel = SimbaConfig.ProjectConfigStore.get("logLevel");
        expect(oldLogLevel).to.equal("info");
        SimbaConfig.logLevel = "debug" as any;
        const newLogLevel = SimbaConfig.ProjectConfigStore.get("logLevel");
        expect(newLogLevel).to.equal("debug");
        SimbaConfig.ProjectConfigStore.set("logLevel", oldLogLevel);
    }).timeout(10000);
});