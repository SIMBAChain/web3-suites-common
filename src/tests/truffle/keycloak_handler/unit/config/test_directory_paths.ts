import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import { expect } from 'chai';
import 'mocha';
import * as path from 'path';
import {cwd} from 'process';

describe('tests artifactDirectory', () => {
    it('should be path.join(cwd(), "build")', async () => {
        const artifactDirectory = SimbaConfig.artifactDirectory;
        expect(artifactDirectory).to.equal(path.join(cwd(), "build"));
    }).timeout(10000);;
});

describe('tests buildDirectory', () => {
    it('should be path.join(cwd(), "build/contracts")', async () => {
        const buildDirectory = SimbaConfig.buildDirectory;
        expect(buildDirectory).to.equal(path.join(cwd(), "build/contracts"));
    }).timeout(10000);;
});