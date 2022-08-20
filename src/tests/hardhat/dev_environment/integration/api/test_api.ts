import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    AzureHandler,
} from "../../../../../commands/lib/authentication";
import {
    pullContractsInteractive,
    pullAllMostRecentContracts,
    pullAllMostRecentSolFilesAndSourceCode,
    pullMostRecentRecentSolFileFromContractName,
    pullMostRecentFromContractName
} from "../../../../../commands/contract";
import {
    WindowsOrMacFileName,
    parseBuildInfoJsonName,
    getASTNodes,
    getContractKind,
    isLibrary,
    getASTAndOtherInfo,
    contractAbsolutePath,
    ASTAndOtherInfo,
    buildInfoJsonName,
    astAndOtherInfo,
    writeAndReturnASTAndOtherInfo,
    chooseApplicationFromName,
    selectNewApplicationName,
    getBlockchains,
    getStorages,
} from "../../../../../commands/lib";
import {
    printAllContracts,
} from "../../../../../commands/contract/list"
import {
    FileHandler,
} from "../../../../tests_setup"
import { expect } from 'chai';
import 'mocha';
import * as path from 'path';
import {cwd} from 'process';

describe('test getBlockchains', () => {
    it('result should exist', async () => {
        const blockChains = await getBlockchains(new SimbaConfig())
        expect(blockChains).to.exist;
    });
});

describe('test getStorages', () => {
    it('result should exist', async () => {
        const storages = await getStorages(new SimbaConfig())
        expect(storages).to.exist;
    });
});