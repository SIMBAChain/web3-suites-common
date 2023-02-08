import fs from 'fs';
import path from 'path';
import {cwd} from 'process';
import {default as chalk} from 'chalk';
import {
    SimbaConfig,
} from "../lib";

export const web3SuiteErrorMessage = `${chalk.redBright(`It looks like you do not have a hardhat or truffle config file present in you project root. You need to make sure that you are using either a hardhat project or a truffle project. If you are using a hardhat project, you will have a hardhat.config.ts/js file in your project root. If you are using a truffle project, you will have a truffle-config.js file in your project root. It may also be the case that you've accidentally place BOTH a truffle config AND a hardhat config file in your project root. Please make sure you are not mixing hardhat and truffle projects.`)}`

export function discoverAndSetWeb3Suite(): string | void {
    SimbaConfig.log.info("ENTER :: discoverAndSetWeb3Called");
    const hardhatTSPath = path.join(cwd(), "hardhat.config.ts");
    const hardhatJSPath = path.join(cwd(), "hardhat.config.js");
    const truffleJSPath = path.join(cwd(), "truffle-config.js");

    const web3SuiteFromSimbaConfig = SimbaConfig.ProjectConfigStore.get("web3Suite");
    if (web3SuiteFromSimbaConfig) {
        return web3SuiteFromSimbaConfig.toLowerCase();
    }
    
    if (fs.existsSync(truffleJSPath) && (fs.existsSync(hardhatJSPath) || fs.existsSync(hardhatTSPath))) {
        const message = `${chalk.redBright(`It looks like you have a truffle config file and a hardhat config file. Please make sure your project is EITHER a hardhat project OR a truffle project`)}`;
        throw new Error(message);
    }
    if (fs.existsSync(hardhatJSPath) || fs.existsSync(hardhatTSPath)) {
        const web3Suite = "hardhat";
        SimbaConfig.ProjectConfigStore.set("web3Suite", web3Suite);
        return web3Suite;
    }
    if (fs.existsSync(truffleJSPath)) {
        const web3Suite = "truffle";
        SimbaConfig.ProjectConfigStore.set("web3Suite", web3Suite);
        return web3Suite;
    }
    throw new Error(`${chalk.redBright(`It looks like you do not have a hardhat or truffle config file present in you project root. You need to make sure that you are using either a hardhat project or a truffle project. If you are using a hardhat project, you will have a hardhat.config.ts/js file in your project root. If you are using a truffle project, you will have a truffle-config.js file in your project root.`)}`);
}
