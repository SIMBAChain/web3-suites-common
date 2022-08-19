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
} from "../../../../../commands/lib";
import {
    printAllContracts,
} from "../../../../../commands/contract/list"
import { expect } from 'chai';
import 'mocha';
import {
    testContractVT20AST,
} from "./sample_ast";

describe('basic test of getting file name, agnostic towards OS', () => {
    it('should be TestContractVT3.sol', () => {
        const contractName = "TestContractVT3"
        const macPath = `/contracts/SimbaImports/${contractName}`;
        const windowsPath = `\\contracts\\SimbaImports\\${contractName}`;
        const macName = WindowsOrMacFileName(macPath);
        const windowsName = WindowsOrMacFileName(windowsPath);
        expect(macName).to.equal(contractName);
        expect(windowsName).to.equal(contractName);
    });

    it('should be "fc60cca1c3038646bb57f93b2a8c9aa9.json"', async () => {
        const fileName = "fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const macPath = "../../build-info/fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const windowsPath = "..\\..\\build-info\\fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const macName = parseBuildInfoJsonName(macPath);
        const windowsName = parseBuildInfoJsonName(windowsPath);
        expect(macName).to.equal(fileName);
        expect(windowsName).to.equal(windowsName);
    });
});

describe('tests related to parsing buildInfo (for hardhat)', () => {
    it('should be "fc60cca1c3038646bb57f93b2a8c9aa9.json"', async () => {
        const fileName = "fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const macPath = "../../build-info/fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const windowsPath = "..\\..\\build-info\\fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const macName = parseBuildInfoJsonName(macPath);
        const windowsName = parseBuildInfoJsonName(windowsPath);
        expect(macName).to.equal(fileName);
        expect(windowsName).to.equal(windowsName);
    });

    it('should be "fc60cca1c3038646bb57f93b2a8c9aa9.json"', async () => {
        const fileName = "fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const contractSourceName = "TestContractVT20.sol";
        const contractName = "TestContractVT20"
        const _buildInfoJsonName = await buildInfoJsonName(contractName, contractSourceName);
        expect(_buildInfoJsonName).to.equal(fileName);
    });
});

describe('tests related to ast', () => {
    const ast = testContractVT20AST;
    it('nodeType should exist in first element', () => {
        const nodes = getASTNodes(ast);
        expect(nodes[0].nodeType).to.exist;
    });

    it('should be "contract"', async () => {
        const contractName = "TestContractVT20";
        const contractKind = getContractKind(contractName, ast);
        expect(contractKind).to.equal("contract");
    });

    it('should be false', () => {
        const contractName = "TestContractVT20";
        const isLib = isLibrary(contractName, testContractVT20AST);
        expect(isLib).to.equal(false);
    })
});

describe('tests astAndOtherInfo info from contractName and contractSourceName and buildInfoSourceName', () => {
    it('ast and source should exist on result', async () => {
        const contractSourceName = "contracts/TestContractVT20.sol";
        const contractName = "TestContractVT20"
        const _buildInfoJsonName = await buildInfoJsonName(contractName, contractSourceName);
        const _astAndOtherInfo = await astAndOtherInfo(
            contractName,
            contractSourceName,
            _buildInfoJsonName,
        );
        expect(_astAndOtherInfo.ast).to.exist;
        expect(_astAndOtherInfo.source).to.exist;
    });
});

describe('tests getASTAndOtherInfo info from contractName and contractSourceName', () => {
    it('ast and source should exist on result', async () => {
        const contractSourceName = "contracts/TestContractVT20.sol";
        const contractName = "TestContractVT20"
        const _astAndOtherInfo = await getASTAndOtherInfo(
            contractName,
            contractSourceName,
        ) as ASTAndOtherInfo;
        expect(_astAndOtherInfo.ast).to.exist;
        expect(_astAndOtherInfo.source).to.exist;
    });
});

