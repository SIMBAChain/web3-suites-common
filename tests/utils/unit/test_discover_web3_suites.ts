import {
    discoverAndSetWeb3Suite,
} from "../../../src/commands/lib/utils";
import {
    SimbaConfig,
} from "../../../src/commands/lib";
import {
    FileHandler,
} from "../../tests_setup";
import { expect } from 'chai';
import "mocha";
import path from "path";
import {cwd} from "process";

describe('testing discoverAndSetWeb3Suites', () => {
    it('should be hardhat, from hardhat.config.ts/js, then from simba.json', async () => {
        const pathToHardhatConfigTS = path.join(
            cwd(),
            "../",
            "tests_setup",
            "backup_files",
            "hardhat.config.ts",
        );
        const pathToHardhatConfigJS = path.join(
            cwd(),
            "../",
            "tests_setup",
            "backup_files",
            "hardhat.config.js",
        );
        const localHardhatconfigTS = path.join(cwd(), "hardhat.config.ts");
        const localHardhatconfigJS = path.join(cwd(), "hardhat.config.js");
        const localTruffleConfig = path.join(cwd(), "truffle-config.js")
        const localSimbaJson = path.join(cwd(), "simba.json");
        // remove files to get everything setup
        FileHandler.removeFile(localHardhatconfigTS);
        FileHandler.removeFile(localHardhatconfigJS);
        FileHandler.removeFile(localTruffleConfig);
        FileHandler.removeFile(localSimbaJson);

        await FileHandler.transferFile(pathToHardhatConfigTS, localHardhatconfigTS);
        
        // first discover from finding a hardhat.config.ts file
        let web3Suite = discoverAndSetWeb3Suite();
        expect(web3Suite).to.equal("hardhat");
        // now make sure we wrote to simba.json
        const web3SuiteFromConfig = SimbaConfig.ProjectConfigStore.get("web3Suite");
        expect(web3SuiteFromConfig).to.equal("hardhat");

        // now discover from simba.json - also making sure it was written to simba.json
        FileHandler.removeFile(localHardhatconfigTS);
        web3Suite = discoverAndSetWeb3Suite();
        expect(web3Suite).to.equal("hardhat");

        // now discover from hardhat.config.js
        FileHandler.removeFile(localSimbaJson);
        await FileHandler.transferFile(pathToHardhatConfigJS, localHardhatconfigJS);
        web3Suite = discoverAndSetWeb3Suite();
        expect(web3Suite).to.equal("hardhat");

        FileHandler.removeFile(localHardhatconfigJS);
        FileHandler.removeFile(localSimbaJson);
    });

    it('should be truffle, from truffle-config.js, then from simba.json', async () => {
        const pathToTruffleConfig = path.join(
            cwd(),
            "../",
            "tests_setup",
            "backup_files",
            "truffle-config.js",
        );
        const localTruffleConfig = path.join(cwd(), "truffle-config.js");
        const localSimbaJson = path.join(cwd(), "simba.json");
        FileHandler.removeFile(localTruffleConfig);
        FileHandler.removeFile(localSimbaJson);

        await FileHandler.transferFile(pathToTruffleConfig, localTruffleConfig);
        
        // first discover from finding a hardhat.config.ts file
        let web3Suite = discoverAndSetWeb3Suite();
        expect(web3Suite).to.equal("truffle");
        // now make sure we wrote to simba.json
        const web3SuiteFromConfig = SimbaConfig.ProjectConfigStore.get("web3Suite");
        expect(web3SuiteFromConfig).to.equal("truffle");

        // now discover from simba.json
        FileHandler.removeFile(localTruffleConfig);
        web3Suite = discoverAndSetWeb3Suite();
        expect(web3Suite).to.equal("truffle");

        FileHandler.removeFile(localTruffleConfig);
        FileHandler.removeFile(localSimbaJson);
    });

    it('should throw error, since no simba.json and no config files present', async () => {
        try {
            discoverAndSetWeb3Suite();
        } catch (error) {
            expect(error.message).to.equal("It looks like you do not have a hardhat or truffle config file present in you project root. You need to make sure that you are using either a hardhat project or a truffle project. If you are using a hardhat project, you will have a hardhat.config.ts/js file in your project root. If you are using a truffle project, you will have a truffle-config.js file in your project root.");
        }
    });

    it('should throw error, truffle and hardhat config files are present', async () => {
        const pathToHardhatConfigTS = path.join(
            cwd(),
            "../",
            "tests_setup",
            "backup_files",
            "hardhat.config.ts",
        );
        const pathToTruffleConfig = path.join(
            cwd(),
            "../",
            "tests_setup",
            "backup_files",
            "truffle-config.js",
        );
        const localHardhatconfigTS = path.join(cwd(), "hardhat.config.ts");
        const localTruffleConfig = path.join(cwd(), "truffle-config.js");
        await FileHandler.transferFile(pathToHardhatConfigTS, localHardhatconfigTS);
        await FileHandler.transferFile(pathToTruffleConfig, localTruffleConfig);
        try {
            discoverAndSetWeb3Suite();
        } catch (error) {
            expect(error.message).to.equal("It looks like you have a truffle config file and a hardhat config file. Please make sure your project is EITHER a hardhat project OR a truffle project");
        }
        FileHandler.removeFile(localHardhatconfigTS);
        FileHandler.removeFile(localTruffleConfig);
    });
});