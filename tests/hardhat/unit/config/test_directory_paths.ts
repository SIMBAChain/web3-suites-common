import {
    SimbaConfig,
} from "../../../../src/commands/lib/config";
import { expect } from 'chai';
import 'mocha';
import * as path from 'path';
import {cwd} from 'process';

describe('tests artifactDirectory', () => {
    it('should be path.join(cwd(), "artifacts")', async () => {
        const artifactDirectory = SimbaConfig.artifactDirectory;
        expect(artifactDirectory).to.equal(path.join(cwd(), "artifacts"));
    }).timeout(10000);
});

describe('tests buildInfoDirectory', () => {
    it('should be path.join(cwd(), "artifacts/build-info")', async () => {
        const artifactDirectory = SimbaConfig.buildInfoDirectory;
        expect(artifactDirectory).to.equal(path.join(cwd(), "artifacts/build-info"));
    }).timeout(10000);
});

describe('tests buildDirectory', () => {
    it('should be path.join(cwd(), "artifacts/contracts")', async () => {
        const buildDirectory = SimbaConfig.buildDirectory;
        expect(buildDirectory).to.equal(path.join(cwd(), "artifacts/contracts"));
    }).timeout(10000);
});