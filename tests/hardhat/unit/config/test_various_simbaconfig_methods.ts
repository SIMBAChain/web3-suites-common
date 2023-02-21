import {
    SimbaConfig,
} from "../../../../src/commands/lib/config";
import { expect } from 'chai';
import 'mocha';

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