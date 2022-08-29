import {
    absolutePaths,
    contractAbsolutePath,
    contractSimbaPath,
    SimbaConfig,
    SimbaInfo,
} from "../../../../../commands/lib";
import {
    promisifiedReadFile,
    walkDirForContracts,
} from "../../../../.."
import {
    FileHandler,
} from "../../../../tests_setup"
import * as fs from "fs";
import { expect } from 'chai';
import 'mocha';
import * as path from 'path';
import {cwd} from 'process';


describe('testing printSingleContract', () => {
    it('length should be two', async () => {
        SimbaInfo.printSingleContract("TestContractVT20");
    });
});

