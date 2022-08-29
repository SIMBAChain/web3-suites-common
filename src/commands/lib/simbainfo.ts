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
}