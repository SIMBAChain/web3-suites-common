import {
    WindowsOrMacFileName,
    parseBuildInfoJsonName,
    getASTNodes,
    getContractKind,
    isLibrary,
    getASTAndOtherInfo,
    ASTAndOtherInfo,
    buildInfoJsonName,
    astAndOtherInfo,
    writeAndReturnASTAndOtherInfo,
    getABIForPrimaryContract,
    primaryContractConstructor,
    primaryConstructorInputs,
    primaryConstructorRequiresArgs,
} from "../../../../commands/lib";
import {
    FileHandler,
    testContractVT20AST,
} from "../../../tests_setup"
import { expect } from 'chai';
import 'mocha';

describe('basic test of getting file name, agnostic towards OS', () => {
    it('should be TestContractVT3.sol', () => {
        const contractName = "TestContractVT3"
        const macPath = `/contracts/SimbaImports/${contractName}`;
        const windowsPath = `\\contracts\\SimbaImports\\${contractName}`;
        const macName = WindowsOrMacFileName(macPath);
        const windowsName = WindowsOrMacFileName(windowsPath);
        expect(macName).to.equal(contractName);
        expect(windowsName).to.equal(contractName);
    }).timeout(10000);

    it('should be "fc60cca1c3038646bb57f93b2a8c9aa9.json"', async () => {
        const fileName = "fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const macPath = "../../build-info/fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const windowsPath = "..\\..\\build-info\\fc60cca1c3038646bb57f93b2a8c9aa9.json";
        const macName = parseBuildInfoJsonName(macPath);
        const windowsName = parseBuildInfoJsonName(windowsPath);
        expect(macName).to.equal(fileName);
        expect(windowsName).to.equal(fileName);
    }).timeout(10000);
});

describe('tests related to ast', () => {
    const ast = testContractVT20AST;
    it('nodeType should exist in first element', () => {
        const nodes = getASTNodes(ast);
        expect(nodes[0].nodeType).to.exist;
    }).timeout(10000);

    it('should be "contract"', async () => {
        const contractName = "TestContractVT20";
        const contractKind = getContractKind(contractName, ast);
        expect(contractKind).to.equal("contract");
    }).timeout(10000);

    it('should be false', () => {
        const contractName = "TestContractVT20";
        const isLib = isLibrary(contractName, testContractVT20AST);
        expect(isLib).to.equal(false);
    }).timeout(10000);
});

describe('tests getABIForPrimaryContract', () => {
    it('abi.length should be > 0', async () => {
        const abi = await getABIForPrimaryContract();
        expect(abi.length).to.be.greaterThan(0);
    }).timeout(10000);
});

describe('tests primaryContractConstructor', () => {
    it('names for first two elements of primaryConstructor.inputs should be _ourNum and _ourString', async () => {
        const primaryConstructor = await primaryContractConstructor();
        expect(primaryConstructor.inputs[0].name).to.equal("_ourNum");
        expect(primaryConstructor.inputs[1].name).to.equal("_ourString");
    }).timeout(10000);
});

describe('tests primaryConstructorInputs', () => {
    it('type, name for first two entries should be uint256, _ourNum and string, _ourString', async () => {
        const constructorInputs: any = await primaryConstructorInputs();
        expect(constructorInputs[0].name).to.equal("_ourNum");
        expect(constructorInputs[1].name).to.equal("_ourString");
        expect(constructorInputs[0].type).to.equal("uint256");
        expect(constructorInputs[1].type).to.equal("string");
    }).timeout(10000);
});

describe('tests primaryConstructorRequiresArgs', () => {
    it('should be true', async () => {
        const requiresArgs = await primaryConstructorRequiresArgs();
        expect(requiresArgs).to.equal(true);
    }).timeout(10000);
});
