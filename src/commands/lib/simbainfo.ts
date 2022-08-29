import Configstore from "configstore";
import {
    SimbaConfig,
    handleV2,
} from "../lib";
import {default as cryptoRandomString} from 'crypto-random-string';
import * as CryptoJS from 'crypto-js';
import {default as chalk} from 'chalk';
import {Request, default as polka} from 'polka';
import * as request from 'request-promise';
import axios from "axios";
import * as fs from 'fs';
import * as path from 'path';
import * as http from "http";
import {
    URLSearchParams,
} from "url";
import {
    EnvVariableKeys,
} from "./config";
import utf8 from "utf8";

const AUTHKEY = "SIMBAAUTH";

export class SimbaInfo {
    private static chalkObject(obj: Record<any, any> | string | number | Array<any>): string {
        SimbaConfig.log.debug(`:: ENTER : obj: ${JSON.stringify(obj)}`);
        let chalkString = "";
        if (Object.prototype.toString.call(obj) === '[object Object]') {
            const _obj = obj as any;
            chalkString += `${chalk.cyanBright(`\n{`)}`;
            for (let key in _obj) {
                chalkString += `\n\t${chalk.greenBright(key)}: ${chalk.cyanBright(_obj[key])},`;
            }
            chalkString += `${chalk.cyanBright(`\n}`)}`;
            SimbaConfig.log.debug(`:: EXIT :`);
            return chalkString;
        }
        else chalkString += `${chalk.cyanBright(`${obj}`)}`;
        SimbaConfig.log.debug(`:: EXIT :`);
        return chalkString;
    }

    public static printChalkedOjbect(obj: Record<any, any>): void {
        SimbaConfig.log.debug(`:: ENTER : obj : ${JSON.stringify(obj)}`);
        const chalkedObject = this.chalkObject(obj);
        SimbaConfig.log.info(`${chalkedObject}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    private static getProjectConfig(key?: string) {
        SimbaConfig.log.debug(`:: ENTER : key : ${key}`);
        if (key) {
            const val = SimbaConfig.ProjectConfigStore.get(key) ?
                SimbaConfig.ProjectConfigStore.get(key) :
                null;
            SimbaConfig.log.debug(`:: EXIT : val : ${JSON.stringify(val)}`);
            return val;
        } else {
            const allSimbaJson = SimbaConfig.ProjectConfigStore.all;
            SimbaConfig.log.debug(`:: EXIT : returning all of simba.json`);
            return allSimbaJson;
        }
    }

    private static getAuthConfig(key?: string) {
        const baseURL = SimbaConfig.ProjectConfigStore.get("baseURL");
        const configBase = baseURL.split(".").join("_");
        SimbaConfig.log.debug(`:: ENTER : key : ${key}`);
        const authConfig = SimbaConfig.ConfigStore.all;
        if (!authConfig) {
            SimbaConfig.log.debug(`:: no info present in authconfig.json`);
            SimbaConfig.log.debug(`:: EXIT :`);
            return null;
        }
        const authInfo = authConfig[configBase];
        if (!authInfo) {
            SimbaConfig.log.debug(`:: no auth info set for ${configBase} in authconfig.json`);
            SimbaConfig.log.debug(`:: EXIT :`);
            return null;
        }
        if (key) {
            const val = authInfo[key] !== undefined ?
                SimbaConfig.ProjectConfigStore.get(key) :
                null;
            SimbaConfig.log.debug(`:: EXIT : val : ${JSON.stringify(val)}`);
            return val;
        } else {
            SimbaConfig.log.debug(`:: EXIT : returning all fields for ${configBase}`);
            return authInfo;
        }
    }

    private static getContractsInfo(): Record<any, any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const contractsInfo = this.getProjectConfig("contracts_info") ?
            this.getProjectConfig("contracts_info") :
            {};
        SimbaConfig.log.debug(`:: EXIT : contracts_info : ${JSON.stringify(contractsInfo)}`);
        return contractsInfo;
    }

    private static getSingleContractInfo(contractName: string) {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        const contractsInfo = this.getContractsInfo();
        const singleContractInfo = contractsInfo[contractName] ?
            contractsInfo[contractName] :
            {};
        SimbaConfig.log.debug(`:: EXIT : singleContractInfo : ${JSON.stringify(singleContractInfo)}`);
        return singleContractInfo;
    }

    public static printSingleContract(contractName: string): void {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        const contract = this.getSingleContractInfo(contractName);
        SimbaConfig.log.info(`${chalk.yellowBright(`${contractName}`)}`);
        this.printChalkedOjbect(contract);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    public static printAllContracts(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const allContracts = this.getContractsInfo();
        for (let contractName in allContracts) {
            this.printSingleContract(contractName);
        }
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    public static printChalkedOrg(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const org = this.getProjectConfig("organisation");
        const chalkedOrg = this.chalkObject(org);
        SimbaConfig.log.info(`${chalk.cyanBright(`organisation:\n${chalkedOrg}`)}`);
        SimbaConfig.log.debug(`:: EXIT : `);
        return;
    }

    public static printChalkedApp(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const app = this.getProjectConfig("application");
        const chalkedApp = this.chalkObject(app);
        SimbaConfig.log.info(`${chalk.cyanBright(`application:\n${chalkedApp}`)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }
}