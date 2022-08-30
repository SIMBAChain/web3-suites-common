import {
    SimbaConfig,
} from "../lib";
import {default as chalk} from 'chalk';

export class SimbaInfo {
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
                chalkString += `\n\t${chalk.greenBright(key)}: ${chalk.cyanBright(_obj[key])},`;
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

    public static printChalkedObject(obj: Record<any, any>, objName?: string): void {
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

    private static getAuthToken(key?: string) {
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

    public static printAuthToken(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const authToken = this.getAuthToken();
        this.printChalkedObject(authToken, "current_auth_token ('SIMBAAUTH')");
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
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
        this.printChalkedObject(contract, contractName);
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

    public static printAllSimbaJson(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const allSimba = SimbaConfig.ProjectConfigStore.all;
        for (let key in allSimba) {
            const val = allSimba[key];
            if (Object.prototype.toString.call(val) === '[object Object]') {
                allSimba[key] = this.chalkObject(val)
            }
        }
        this.printChalkedObject(allSimba, "simba.json");
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    public static printOrg(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const org = this.getProjectConfig("organisation");
        this.printChalkedObject(org, org.name);
        SimbaConfig.log.debug(`:: EXIT : `);
        return;
    }

    public static printApp(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const app = this.getProjectConfig("application");
        this.printChalkedObject(app, app.name);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    public static printMostRecentDeploymentInfo(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const deployInfo = this.getProjectConfig("most_recent_deployment_info");
        this.printChalkedObject(deployInfo, "most_recent_deployment_info");
        return;
    }

    public static printAuthProviderInfo(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const authProviderInfo = this.getProjectConfig("authProviderInfo");
        this.printChalkedObject(authProviderInfo, "authProviderInfo");
        return;
    }

    public static printWeb3Suite(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        const web3Suite = this.getProjectConfig("web3Suite");
        this.printChalkedObject(web3Suite, "web3Suite");
        return;
    }
}