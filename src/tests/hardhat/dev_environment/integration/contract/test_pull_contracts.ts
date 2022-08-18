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
    pullMostRecentFromContractName,
    addLib,
    SourceCodeComparer,
} from "../../../../../commands/contract";
import {
    promisifiedReadFile,
    walkDirForContracts,
} from "../../../../../"
import {
    allContracts,
    printAllContracts,
} from "../../../../../commands/contract/list";
import {
    FileHandler,
} from "../../../../tests_setup"
import * as fs from "fs";
import {default as chalk} from 'chalk';
import { expect } from 'chai';
import 'mocha';
import { pullContractFromContractDesign, pullContractFromDesignId, pullMostRecentSourceCodeFromContractName } from "../../../../../commands/contract/pull";

const contractName = "TestContractVT3";
const oldContractID = "cb3ad592-1ca2-43b3-a9d0-cd0d0f127b32";
// filePaths should be relative to tests/hardhat/
const simbaDir = `./contracts/SimbaImports/`;
const filePath = `${simbaDir}${contractName}.sol`;

describe('testing pulling .sol file from designID', () => { // the tests container
    it('should exist in /contracts/simbaimports/ after', async () => {
        const simbaConfig = new SimbaConfig();
        const authStore = await simbaConfig.authStore();
        if (authStore instanceof AzureHandler) {
            FileHandler.removeDirectory(simbaDir);
            await authStore.performLogin(false);
            let exists = fs.existsSync(filePath);
            expect(exists).to.equal(false);
            await pullContractFromDesignId(oldContractID);
            exists = fs.existsSync(filePath);
            expect(exists).to.equal(true);
            FileHandler.removeDirectory(simbaDir);
        }
    }).timeout(100000);
});

describe('testing pulling .sol files using contractDesigns and other params', () => { // the tests container
    it('contracts should exist in /contracts/simbaimports/ after', async () => {
        const simbaConfig = new SimbaConfig();
        const authStore = await simbaConfig.authStore();
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

        if (authStore instanceof AzureHandler) {
            
            await authStore.performLogin(false);
            let exists = fs.existsSync(simbaDir);
            expect(exists).to.equal(false);

            await pullContractFromContractDesign(firstContract);
            let filePath = `${simbaDir}${firstContractName}.sol`;
            exists = fs.existsSync(filePath);
            expect(exists).to.equal(true);
            
            FileHandler.removeDirectory(simbaDir);

            exists = fs.existsSync(simbaDir);
            expect(exists).to.equal(false);
            await pullMostRecentRecentSolFileFromContractName(firstContractName, contractDesigns);
            filePath = `${simbaDir}${firstContractName}.sol`;
            exists = fs.existsSync(filePath);
            expect(exists).to.equal(true);
            
            FileHandler.removeDirectory(simbaDir);

            exists = fs.existsSync(simbaDir);
            expect(exists).to.equal(false);
            await pullAllMostRecentContracts(contractDesigns);
            // now make sure each contract's .sol file was pulled
            for (let i = 0; i < contractNames.length; i++) {
                filePath = `${simbaDir}${contractNames[i]}.sol`;
                let exists = fs.existsSync(filePath);
                expect(exists).to.equal(true);
            }

            FileHandler.removeDirectory(simbaDir);

        }
    }).timeout(100000);
});

// // pick up with this one tomorrow
// describe('testing pulling source code to simba.json', () => { // the tests container
//     it('source code should be in simba.json after function calls', async () => {
//         const simbaConfig = new SimbaConfig();
//         const authStore = await simbaConfig.authStore();
//         const originalSimbaJson = SimbaConfig.ProjectConfigStore.all;
//         SimbaConfig.resetSimbaJson();
//         const contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
//         expect(contractsInfo).to.eq(undefined);
//         // expect(contractsInfo).to.eq(undefined || null);

//         if (authStore instanceof AzureHandler) {
//             await authStore.performLogin(false);
//             // now set one contract's source code in simba.json:
//             await pullMostRecentSourceCodeFromContractName(contractName);
//             let contractsInfo = SimbaConfig.ProjectConfigStore.get("contracts_info");
//             let entry = contractsInfo[contractName];
//             expect(entry).to.not.eq(undefined);
//             expect(entry).to.not.eq(null);
//             SimbaConfig.resetSimbaJson();

//             // now pull using contractDesign

//         }
//         SimbaConfig.ProjectConfigStore.set(originalSimbaJson)
//     }).timeout(100000);
// });
