import {
    SimbaConfig,
} from "../../../../src/commands/lib/config";
import {
    pullAllMostRecentContracts,
    pullAllMostRecentSolFilesAndSourceCode,
    pullMostRecentRecentSolFileFromContractName,
    pullMostRecentFromContractName,
    allContracts,
} from "../../../../src/commands/contract";
const contractLib = require("../../../../src/commands/contract/list");
import {
    pullSourceCodeForSimbaJson
} from "../../../.."
import {
    FileHandler,
} from "../../../tests_setup"
import * as fs from "fs";
import { expect } from 'chai';
import 'mocha';
import {
    pullContractFromContractDesign,
    pullContractFromDesignId,
    pullMostRecentSourceCodeFromContractName,
} from "../../../../src/commands/contract/pull";
import * as path from 'path';
import {cwd} from 'process';
import {
    allContractsStubFunc,
} from "../../../tests_setup";
import sinon from "sinon";

const contractDesignsPath = "../tests_setup/contract_designs/hardhat_az/contract_designs.json";

describe('testing pulling .sol file from designID', () => {
    it('should exist in /contracts/simbaimports/ after', async () => {
        let simbaDir = path.join(cwd(), "contracts", "SimbaImports");
        const contractName = "TestContractVT3";
        const oldContractID = "cb3ad592-1ca2-43b3-a9d0-cd0d0f127b32";
        const filePath = path.join(simbaDir, `${contractName}.sol`);
        const simbaConfig = new SimbaConfig();
        const authStore = await simbaConfig.authStore();
        FileHandler.removeDirectory(simbaDir);
        await authStore!.performLogin(false);
        let exists = fs.existsSync(filePath);
        expect(exists).to.equal(false);
        await pullContractFromDesignId(oldContractID);
        exists = fs.existsSync(filePath);
        expect(exists).to.equal(true);
        FileHandler.removeDirectory(simbaDir);
    }).timeout(20000);
});

describe('testing pulling .sol files using contractDesigns and other params', () => {
    it('contracts should exist in /contracts/simbaimports/ after', async () => {
        let simbaDir = path.join(cwd(), "contracts", "SimbaImports");
        const simbaConfig = new SimbaConfig();
        const authStore = await simbaConfig.authStore();
        await authStore!.performLogin(false);

        // here we define our stub
        const fakeContractData = await allContractsStubFunc("dev");
        const sandbox = sinon.createSandbox();
        sandbox.stub(contractLib, "allContracts").callsFake(() => fakeContractData);

        const contractDesigns: any = await allContracts();

        let contractNames: any = [];
        for (let i = 0; i < contractDesigns.length; i++) {
            const contractName = contractDesigns[i].name;
            if (!contractNames.includes(contractName)) {
                contractNames.push(contractName);
            }
        }
        const firstContract = contractDesigns[0];
        const firstContractName = firstContract.name;
        // clean up our contracts/SimbaImports folder first
        FileHandler.removeDirectory(simbaDir);
        let exists = fs.existsSync(simbaDir);
        expect(exists).to.equal(false);

        await pullContractFromContractDesign(firstContract);
        let filePath = path.join(simbaDir, `${firstContractName}.sol`);
        exists = fs.existsSync(filePath);
        expect(exists).to.equal(true);
        
        FileHandler.removeDirectory(simbaDir);

        exists = fs.existsSync(simbaDir);
        expect(exists).to.equal(false);
        await pullMostRecentRecentSolFileFromContractName(firstContractName, contractDesigns);
        filePath = path.join(simbaDir, `${firstContractName}.sol`);
        exists = fs.existsSync(filePath);
        expect(exists).to.equal(true);
        
        FileHandler.removeDirectory(simbaDir);

        exists = fs.existsSync(simbaDir);
        expect(exists).to.equal(false);
        await pullAllMostRecentContracts(contractDesigns!);
        // now make sure each contract's .sol file was pulled
        for (let i = 0; i < contractNames.length; i++) {
            filePath = path.join(simbaDir, `${contractNames[i]}.sol`);
            let exists = fs.existsSync(filePath);
            expect(exists).to.equal(true);
        }

        // allContractsStub.restore();
        sandbox.restore();
        FileHandler.removeDirectory(simbaDir);
    }).timeout(60000);
});

describe('testing pulling source code to simba.json', () => {
    it('source code should be in simba.json after function calls', async () => {
        const contractName = "TestContractVT3";
        const contractDesigns = await FileHandler.parsedFile(contractDesignsPath);
        const simbaConfig = new SimbaConfig();
        const authStore = await simbaConfig.authStore();
        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        SimbaConfig.resetSimbaJson(originalSimbaJson, null, true);
        let contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        let currentKeysLength = Object.keys(contractsInfo).length
        expect(currentKeysLength).to.eq(0);


        await authStore!.performLogin(false);
        // now set one contract's source code in simba.json:
        await pullMostRecentSourceCodeFromContractName(contractName, contractDesigns);
        contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        let entry = contractsInfo[contractName];
        expect(entry).to.not.eq(undefined);
        expect(entry).to.not.eq(null);
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);

        // now pull using contractDesign
        SimbaConfig.resetSimbaJson(originalSimbaJson, null, true);
        contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        currentKeysLength = Object.keys(contractsInfo).length
        expect(currentKeysLength).to.eq(0);

        pullSourceCodeForSimbaJson(contractDesigns[0]);
        contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        entry = contractsInfo[contractDesigns[0].name];
        expect(entry).to.not.eq(undefined);
        expect(entry).to.not.eq(null);
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
    }).timeout(20000);
});

describe('testing pulling .sol files to contracts/SimbaImports dir and source code to simba.json', () => {
    it('contracts should exist in /contracts/simbaimports/ after', async () => {
        // resetting
        const simbaConfig = new SimbaConfig();
        const authStore = await simbaConfig.authStore();
        const contractDesigns = await FileHandler.parsedFile(contractDesignsPath);
        let simbaDir = path.join(cwd(), "contracts");
        simbaDir = path.join(simbaDir, "SimbaImports");
        
        // here we define our stub
        const fakeContractData = await allContractsStubFunc("dev");
        const sandbox = sinon.createSandbox();
        sandbox.stub(contractLib, "allContracts").callsFake(() => fakeContractData);

        const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
        let contractNames: any = [];
        for (let i = 0; i < contractDesigns.length; i++) {
            const contractName = contractDesigns[i].name;
            if (!contractNames.includes(contractName)) {
                contractNames.push(contractName);
            }
        }
        const firstContract = contractDesigns[0];
        const firstContractName = firstContract.name;
        // clean up our contracts/SimbaImports folder first
        FileHandler.removeDirectory(simbaDir);


        // prior conditions:
        await authStore!.performLogin(false);
        let exists = fs.existsSync(simbaDir);
        expect(exists).to.equal(false);
        SimbaConfig.resetSimbaJson(originalSimbaJson, null, true);
        let contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        let currentKeysLength = Object.keys(contractsInfo).length
        expect(currentKeysLength).to.eq(0);

        // function
        await pullMostRecentFromContractName(firstContractName, contractDesigns);

        // posterior conditions
        contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        let entry = contractsInfo[contractDesigns[0].name];
        expect(entry).to.not.eq(undefined);
        expect(entry).to.not.eq(null);

        let filePath = path.join(simbaDir, `${firstContractName}.sol`);
        exists = fs.existsSync(filePath);
        expect(exists).to.equal(true);
        
        // resetting
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        FileHandler.removeDirectory(simbaDir);
        SimbaConfig.resetSimbaJson(originalSimbaJson, null, true);

        // prior conditions
        exists = fs.existsSync(simbaDir);
        expect(exists).to.equal(false);
        contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        currentKeysLength = Object.keys(contractsInfo).length
        expect(currentKeysLength).to.eq(0);

        await pullAllMostRecentSolFilesAndSourceCode(true, true);
        
        // posterior conditions
        for (let i = 0; i < contractNames.length; i++) {
            filePath = path.join(simbaDir, `${contractNames[i]}.sol`);
            let exists = fs.existsSync(filePath);
            expect(exists).to.equal(true);
        }
        contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
        for (let i = 0; i < contractNames.length; i++) {
            let exists = Object.keys(contractsInfo).includes(contractNames[i])
            expect(exists).to.equal(true);
        }

        // resetting
        sandbox.restore();
        SimbaConfig.ProjectConfigStore.clear();
        SimbaConfig.ProjectConfigStore.set(originalSimbaJson);
        FileHandler.removeDirectory(simbaDir);
    }).timeout(30000);
});

