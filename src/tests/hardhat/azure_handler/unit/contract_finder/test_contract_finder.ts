// import {
//     absolutePaths,
//     contractAbsolutePath,
//     contractSimbaPath,
// } from "../../../../../commands/lib";
// import {
//     promisifiedReadFile,
//     walkDirForContracts,
// } from "../../../../.."
// import {
//     FileHandler,
// } from "../../../../tests_setup"
// import * as fs from "fs";
// import { expect } from 'chai';
// import 'mocha';
// import * as path from 'path';
// import {cwd} from 'process';


// describe('testing walkDirForContracts', () => {
//     it('length should be two', async () => {
//         const contractsDir = path.join(cwd(), "contracts");
//         const contracts = await walkDirForContracts(contractsDir, ".sol");
//         expect(contracts.length).to.equal(2);
//     });
// });

// describe('testing promisifedReadFile', () => {
//     it('file should exist', async () => {
//         const contractsDir = path.join(cwd(), "contracts");
//         const contractPath = path.join(contractsDir, "TestContractVT20.sol");
//         const file = await promisifiedReadFile(contractPath, {flag: 'r'});
//         expect(file).to.exist;
//     });
// });

// describe('testing absolutePaths', () => {
//     it('entry should exist', async () => {
//         const contractName1 = "TestContractVT20";
//         const contractName2 = "TestContractChanged";
//         const absPaths: any = await absolutePaths();
//         expect(absPaths[contractName1]).to.exist;
//         expect(absPaths[contractName2]).to.exist;
//     });

//     it('entry should exist', async () => {
//         const contractName1 = "TestContractVT20";
//         const absPaths: any = await absolutePaths();
//         const contractName1AbsPath = contractAbsolutePath(absolutePaths, contractName1);
//         expect(contractName1AbsPath).to.equal(absPaths[contractName1]);
//     });
// });

// describe('testing contractSimbaPath', () => {
//     it('SimbaImports should exist after call', async () => {
//         let simbaPath = path.join(cwd(), "contracts");
//         simbaPath = path.join(simbaPath, "SimbaImports");
//         FileHandler.removeDirectory(simbaPath);
//         expect(fs.existsSync(simbaPath)).to.equal(false);
//         const absPaths: any = await absolutePaths();
//         const contractPath = contractSimbaPath(absPaths, "TestContractVT20");
//         let expectedPath = path.join(cwd(), "contracts");
//         expectedPath = path.join(expectedPath, "SimbaImports");
//         expectedPath = path.join(expectedPath, "TestContractVT20.sol");
//         expect(contractPath).to.equal(expectedPath);
//         FileHandler.removeDirectory(simbaPath);
//     });
// });