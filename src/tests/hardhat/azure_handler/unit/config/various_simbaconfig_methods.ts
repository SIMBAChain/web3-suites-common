// import {
//     SimbaConfig,
// } from "../../../../../commands/lib/config";
// import { expect } from 'chai';
// import 'mocha';
// import * as path from 'path';
// import {cwd} from 'process';

// describe('tests web3Suite', () => {
//     it('should be "hardhat"', async () => {
//         const web3Suite = SimbaConfig.web3Suite;
//         expect(web3Suite.toLowerCase()).to.equal("hardhat");
//     });
// });

// describe('tests logLevel', () => {
//     it('should be "hardhat"', async () => {
//         const oldLogLevel = SimbaConfig.ProjectConfigStore.get("logLevel");
//         expect(oldLogLevel).to.equal("info");
//         SimbaConfig.logLevel = "debug" as any;
//         const newLogLevel = SimbaConfig.ProjectConfigStore.get("logLevel");
//         expect(newLogLevel).to.equal("debug");
//         SimbaConfig.ProjectConfigStore.set("logLevel", oldLogLevel);
//     });
// });