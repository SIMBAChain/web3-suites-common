import {
    SimbaConfig,
} from "../lib";
import {default as chalk} from 'chalk';

/**
 * this class is used for printing chalked project info
 */
export class SimbaInfo {
    /**
     * helps us chalk nested objects
     * @param obj 
     * @param objName 
     * @returns {string}
     */
    private static chalkObject(
        obj: Record<any, any> | string | number | Array<any>,
        objName?: string
    ): string {
        SimbaConfig.log.debug(`:: ENTER : obj: ${JSON.stringify(obj)}`);
        let chalkString = objName ? `\n${chalk.yellowBright(`${objName}`)}:` : `\n`;
    
        if (Object.prototype.toString.call(obj) === '[object Object]') {
            const _obj = obj as any;
            chalkString += `${chalk.cyanBright(`\n{`)}`;
            for (let key in _obj) {
                chalkString += `\n\t${chalk.greenBright(key)}: ${chalk.cyanBright(JSON.stringify(_obj[key]))},`;
            }
            chalkString = chalkString.slice(0, -1);
            chalkString += `${chalk.cyanBright(`\n}`)}`;
            SimbaConfig.log.debug(`:: EXIT :`);
            return chalkString;
        }
        else chalkString += ` ${chalk.cyanBright(`${obj}`)}`;
        SimbaConfig.log.debug(`:: EXIT :`);
        return chalkString;
    }

    /**
     * prints a chalked object
     * @param obj 
     * @param objName 
     * @returns {void}
     */
    public static printChalkedObject(obj: Record<any, any> | string | number | Array<any>, objName?: string): void {
        const entryParams = {
            obj,
            objName,
        }
        SimbaConfig.log.debug(`:: ENTER : entryParams : ${JSON.stringify(entryParams)}`);
        const chalkedObj = this.chalkObject(obj, objName);
        SimbaConfig.log.info(`${chalk.cyanBright(`${chalkedObj}`)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    /**
     * gets value for a key from simba.json
     * @param key 
     * @returns 
     */
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

    /**
     * returns auth token from authconfig.json, or value for key in auth token in authconfig.json
     * @param key - if not specified, then entire auth token is returned from authconfig.json
     * @returns {any}
     */
    private static getAuthToken(key?: string): any {
        SimbaConfig.log.debug(`:: ENTER : key : ${key}`);
        const baseURL = SimbaConfig.retrieveBaseAPIURL();
        const configBase = baseURL.split(".").join("_");
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
        if (authInfo.SIMBAAUTH){
            if (authInfo.SIMBAAUTH.access_token) {
                authInfo.SIMBAAUTH.access_token = "*****";
            }
            if (authInfo.SIMBAAUTH.refresh_token) {
                authInfo.SIMBAAUTH.refresh_token = "*****"
            }
        }
        if (key) {
            const val = authInfo[key] !== undefined ?
                SimbaConfig.ConfigStore.get(key) :
                null;
            SimbaConfig.log.debug(`:: EXIT : val : ${JSON.stringify(val)}`);
            return val;
        } else {
            SimbaConfig.log.debug(`:: EXIT : returning all fields for ${configBase}`);
            return authInfo;
        }
    }

    /**
     * prints chalked auth token
     * @returns {void}
     */
    public static printAuthToken(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const authToken = this.getAuthToken();
        this.printChalkedObject(authToken, "current_auth_token ('SIMBAAUTH')");
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    /**
     * gets contracts_info from simba.json
     * @returns {Record<any, any>}
     */
    private static getContractsInfo(): Record<any, any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const contractsInfo = this.getProjectConfig("contracts_info") ?
            this.getProjectConfig("contracts_info") :
            {};
        SimbaConfig.log.debug(`:: EXIT : contracts_info : ${JSON.stringify(contractsInfo)}`);
        return contractsInfo;
    }

    /**
     * gets info for contractName from contracts_info in simba.json
     * @param contractName 
     * @returns 
     */
    private static getSingleContractInfo(contractName: string) {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        const contractsInfo = this.getContractsInfo();
        const singleContractInfo = contractsInfo[contractName] ?
            contractsInfo[contractName] :
            {};
        SimbaConfig.log.debug(`:: EXIT : singleContractInfo : ${JSON.stringify(singleContractInfo)}`);
        return singleContractInfo;
    }

    /**
     * prints chalked single contract from contracts_info in simba.json
     * @param contractName 
     * @returns 
     */
    public static printSingleContract(contractName: string): void {
        SimbaConfig.log.debug(`:: ENTER : contractName : ${contractName}`);
        const contract = this.getSingleContractInfo(contractName);
        this.printChalkedObject(contract, contractName);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    /**
     * prints chalked all contracts from contracts_info in simba.json
     * @returns {void}
     */
    public static printAllContracts(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const allContracts = this.getContractsInfo();
        for (let contractName in allContracts) {
            this.printSingleContract(contractName);
        }
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    /**
     * prints chalked simba.json
     * @returns {void}
     */
    public static printAllSimbaJson(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const allSimba = SimbaConfig.ProjectConfigStore.all;
        SimbaInfo.printChalkedObject(allSimba, "simba.json")
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    /**
     * prints chalked organisation from simba.json
     * @returns {void}
     */
    public static printOrg(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const org = this.getProjectConfig("organisation");
        this.printChalkedObject(org, org.name);
        SimbaConfig.log.debug(`:: EXIT : `);
        return;
    }

    /**
     * prints chalked application from simba.json
     * @returns {void}
     */
    public static printApp(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const app = this.getProjectConfig("application");
        this.printChalkedObject(app, app.name);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    /**
     * prints chalked most_recent_deployment_info from simba.json
     * @returns {void}
     */
    public static printMostRecentDeploymentInfo(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const deployInfo = this.getProjectConfig("most_recent_deployment_info");
        this.printChalkedObject(deployInfo, "most_recent_deployment_info");
        return;
    }

    /**
     * prints chalked authProviderInfo from simba.json
     * @returns {void}
     */
    public static printAuthProviderInfo(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const authProviderInfo = this.getProjectConfig("authProviderInfo");
        this.printChalkedObject(authProviderInfo, "authProviderInfo");
        return;
    }

    /**
     * prints chalked web3Suite from simba.json
     * @returns {void}
     */
    public static printWeb3Suite(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const web3Suite = this.getProjectConfig("web3Suite");
        this.printChalkedObject(web3Suite, "web3Suite");
        return;
    }

    /**
     * prints chalked baseURL from simba.json
     * @returns {void}
     */
    public static printBaseURL(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const baseURL = SimbaConfig.retrieveBaseAPIURL();
        this.printChalkedObject(baseURL, "baseURL");
        return;
    }
}