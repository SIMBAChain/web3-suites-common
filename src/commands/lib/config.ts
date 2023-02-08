import * as fs from "fs";
import {
    LogLevel,
} from "./logger";
import {
    Logger,
} from "tslog";
import {cwd} from 'process';
import * as path from 'path';
import Configstore from 'configstore';
import {
    KeycloakHandler,
    AzureHandler,
    AuthProviders,
    authErrors,
} from './authentication';
import {
    SimbaInfo,
} from "./simbainfo";
import {default as chalk} from 'chalk';
import axios from "axios";
// const fsPromises = require("fs").promises;

enum WebThreeSuites {
    TRUFFLE = "truffle",
    HARDHAT = "hardhat",
}

enum CompiledDirs {
    ARTIFACTS = "artifacts",
    BUILD = "build",
}

export enum AllDirs {
    BUILDDIRECTORY = "buildDirectory",
    ARTIFACTDIRECTORY = "artifactDirectory",
    CONTRACTDIRECTORY = "contractDirectory",
}

export enum EnvVariableKeys {
    ID = "ID",
    SECRET = "SECRET",
    AUTHENDPOINT = "ENDPOINT"
}

export function handleV2(baseURL: string): string {
    SimbaConfig.log.debug(`:: ENTER : baseURL : ${baseURL}`)
    if (baseURL.endsWith("/v2/") || baseURL.endsWith("/v2")) {
        const extension = baseURL.endsWith("/v2") ? "/v2" : "/v2/";
        const shortenedBaseURL = baseURL.slice(0,-(extension.length));
        SimbaConfig.log.debug(`:: EXIT : ${shortenedBaseURL}`);
        return shortenedBaseURL;
    }
    if (baseURL.endsWith("/")) {
        const shortenedBaseURL = baseURL.slice(0, -1)
        SimbaConfig.log.debug(`:: EXIT : ${shortenedBaseURL}`);
        return shortenedBaseURL;
    }
    SimbaConfig.log.debug(`:: EXIT : ${baseURL}`);
    return baseURL;
}

function handleAlternativeAuthJSON(authInfo: Record<any, any>): Record<any, any> {
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(authInfo)}`);
    const type = authInfo.type;
    let newAuthInfo = {} as any;
    switch(type) {
        case AuthProviders.KEYCLOAKOAUTH2: {
            if (authInfo.config) {
                newAuthInfo.type = type;
                newAuthInfo.realm = authInfo.config.realm;
                newAuthInfo.client_id = authInfo.config.key;
                const baseurl = authInfo.config.host.endsWith("/auth") ?
                    authInfo.config.host :
                    `${authInfo.config.host}/auth`;
                newAuthInfo.baseurl = baseurl;
            }
            break; 
        }
        default: { 
            newAuthInfo = authInfo;
            break; 
        }
    }
    SimbaConfig.log.debug(`:: EXIT :`);
    return newAuthInfo;
}

/**
 * this class handles our configstore operations (eg reading simba.json)
 * http operations are handled by our authStore property.
 * 
 * If you notice throughout this class, the same methods are defined in static
 * and instance methods. This was so that some older code that was integrated,
 * that uses instance methods, would still be supported.
 */
export class SimbaConfig {
    // many of these properties are not actually used. They are here for debugging purposes
    // however, _configStore and _projectConfigStore are used as arguments to instaniate this._authStore
    public static _web3Suite: string;
    // Common config, such as auth
    public static _configStore: Configstore;
    // Project config, such as app ID, etc
    public static _projectConfigStore: Configstore;
    public static help = false;
    public static _authStore: KeycloakHandler | AzureHandler;
    public static _application: any;
    public static _organisation: any;
    public static _build_directory: string;
    public static _log: Logger;

    /**
     *  many of these instance properties are not actually uses
     *  they're just defined here for debugging/logging purposes
     */
    public constructor() {
        const confstore = this.ConfigStore;
        const projconfstore = this.ProjectConfigStore;
        const w3Suite = this.web3Suite;
        const app = this.application;
        const org = this.organisation;
        const authStr = this.authStore;
        const buildDir = this.buildDirectory;
        const logLevel = this.logLevel;
        const log: Logger = new Logger({minLevel:logLevel});
        const constructorParams = {
            confstore,
            projconfstore,
            app,
            org,
            authStr,
            w3Suite,
            buildDir,
            logLevel,
        }
        SimbaConfig.log.debug(`:: ENTER : SimbaConfig constructor params : ${JSON.stringify(constructorParams)}`)

    }

    /**
     * handles our auth / access token info
     */
    public static get ConfigStore(): Configstore {
        if (!this._configStore) {
            this._configStore = new Configstore(`@simbachain/${this._web3Suite}`, null, {
                configPath: path.join(cwd(), 'authconfig.json'),
            });
        }
        return this._configStore;
    }

    public get ConfigStore(): Configstore {
        return SimbaConfig.ConfigStore;
    }

    /**
     * handles project info, contained in simba.json
     */
    public static get ProjectConfigStore(): Configstore {
        if (!this._projectConfigStore) {
            this._projectConfigStore = new Configstore(`@simbachain/${this._web3Suite}`, null, {
                configPath: path.join(cwd(), 'simba.json'),
            });
        }
        return this._projectConfigStore;
    }

    public get ProjectConfigStore(): Configstore {
        return SimbaConfig.ProjectConfigStore;
    }

    public static async retrieveEnvVar(envVarKey: EnvVariableKeys): Promise<string | void> {
        SimbaConfig.log.debug(`:: ENTER : envVarKey : ${envVarKey}`);
        const authProviderInfo = await SimbaConfig.setAndGetAuthProviderInfo();
        const authType = authProviderInfo.type;

        const authMap: any = {
            "azureb2c": "AZURE",
            "keycloak": "KEYCLOAK",
            "KeycloakOAuth2": "KEYCLOAK",
        }

        let val = process.env[`SIMBA_${authMap[authType]}_${envVarKey}`] || 
            process.env[`SIMBA_AUTH_CLIENT_${envVarKey}`] ||
            process.env[`SIMBA_PLUGIN_${envVarKey}`];
        
        if (!val && envVarKey === EnvVariableKeys.AUTHENDPOINT) {
            val = "/o/";
        }
        SimbaConfig.log.debug(`:: EXIT :`);
        return val;
    }

    public async retrieveEnvVar(envVarKey: EnvVariableKeys): Promise<string | void> {
        SimbaConfig.log.debug(`:: ENTER : envVarKey : ${envVarKey}`);
        const val = await SimbaConfig.retrieveEnvVar(envVarKey);
        SimbaConfig.log.debug(`:: EXIT : `);
        return val;
    }

    public static resetSimbaJson(
        previousSimbaJson: Record<any, any>,
        newOrg?: string | Record<any, any> | unknown,
        forceReset: boolean = false,
        keepOrgAndApp: boolean = true,
     ) {
        const entryParams = {
            previousSimbaJson,
            newOrg,
            forceReset,
            keepOrgAndApp,
        }
        SimbaConfig.log.debug(`:: ENTER : entryParams : ${JSON.stringify(entryParams)}`);
        if (forceReset) {
            SimbaConfig.log.debug(`:: forcing reset`)
            const newSimbaJson: any = {
                baseURL: previousSimbaJson.baseURL,
                web3Suite: previousSimbaJson.web3Suite,
                logLevel: previousSimbaJson.logLevel ? previousSimbaJson.logLevel : "info",
                contracts_info: {},
            }
            if (previousSimbaJson.authProviderInfo) {
                newSimbaJson["authProviderInfo"] = previousSimbaJson.authProviderInfo;
            }
            if (keepOrgAndApp) {
                if (previousSimbaJson.organisation) {
                    newSimbaJson["organisation"] = previousSimbaJson.organisation;
                }
                if (previousSimbaJson.application) {
                    newSimbaJson["application"] = previousSimbaJson.application;
                }
            }
            SimbaConfig.ProjectConfigStore.clear();
            SimbaConfig.ProjectConfigStore.set(newSimbaJson);
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
        const previousOrg = previousSimbaJson.organisation;
        if (!newOrg) {
            SimbaConfig.log.debug(`:: EXIT : no new org name specified; no action required`);
            return;
        }
        const previousOrgName = previousSimbaJson.organisation ? previousSimbaJson.organisation.name : null;
        const newOrgName = (typeof newOrg === "string") ?
            newOrg :
            (newOrg as any).name;
        if (!previousOrg) {
            SimbaConfig.log.debug(`:: EXIT : organisation was not previously set; no action required`);
            return;
        }

        if (previousOrgName !== newOrgName) {
            SimbaConfig.log.info(`\nsimba: ${previousOrgName} !== ${newOrgName}; switching orgs, deleting contracts_info`);
            SimbaConfig.ProjectConfigStore.set("contracts_info", {});
            if (!keepOrgAndApp) {
                SimbaConfig.ProjectConfigStore.delete("organisation");
                SimbaConfig.ProjectConfigStore.delete("application");
            }
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        } else {
            SimbaConfig.log.info(`\nsimba: ${previousOrgName} === ${newOrgName}; not switching orgs, no action needed`);
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
    }

    public static deleteSimbaJsonField(key: string) {
        SimbaConfig.log.debug(`:: ENTER : key : ${key}`)
        if (this.ProjectConfigStore.get(key)) {
            this.ProjectConfigStore.delete(key);
            SimbaConfig.log.debug(`${chalk.cyanBright(`key ${key} removed from simba.json`)}`);
        } else {
            SimbaConfig.log.debug(`${chalk.cyanBright(`key ${key} not present in simba.json`)}`);
        }
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    public deleteSimbaJsonField(key: string) {
        SimbaConfig.deleteSimbaJsonField(key);
    }

    public static deleteAuthProviderInfo() {
        SimbaConfig.log.debug(`:: ENTER :`);
        const key = "authProviderInfo";
        SimbaConfig.deleteSimbaJsonField(key);
    }

    public deleteAuthProviderInfo() {
        SimbaConfig.deleteAuthProviderInfo();
    }

    public static async setAndGetAuthProviderInfo(): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (!SimbaConfig.ProjectConfigStore.get("authProviderInfo")) {
            const baseURL = SimbaConfig.ProjectConfigStore.get("baseURL") ?
                SimbaConfig.ProjectConfigStore.get("baseURL") :
                SimbaConfig.ProjectConfigStore.get("baseUrl");
            if (!baseURL) {
                const message = `\nsimba: no baseURL defined in your simba.json!`;
                SimbaConfig.log.error(`${chalk.redBright(`${message}`)}`);
                throw new Error(message);
            }
            const authInfoURL = `${handleV2(baseURL)}/authinfo`;
            SimbaConfig.log.debug(`:: authInfoURL: ${authInfoURL}`);
            try {
                const res = await axios.get(authInfoURL);
                let _authProviderInfo = res.data;
                _authProviderInfo = handleAlternativeAuthJSON(_authProviderInfo);
                SimbaConfig.log.debug(`${chalk.cyanBright(`\n_authProviderInfo: ${JSON.stringify(_authProviderInfo)}`)}`);
                SimbaConfig.ProjectConfigStore.set("authProviderInfo", _authProviderInfo);
                return _authProviderInfo;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
                }
                return;
            } 
                
        }
        return SimbaConfig.ProjectConfigStore.get("authProviderInfo");
    }

    /**
     * currently an instance of KeycloakHandler, but code can be amended
     * to be different kind of authStore once supported
     */
    public static async authStore(): Promise<KeycloakHandler | AzureHandler | null> {
        SimbaConfig.log.debug(`:: ENTER :`)
        if (!this._authStore) {
            SimbaConfig.log.debug(`${chalk.cyanBright(`\nsimba: instantiating new authStore`)}`);
            const _authProviderInfo = await SimbaConfig.setAndGetAuthProviderInfo();
            if (!_authProviderInfo) {
                SimbaConfig.log.error(`${chalk.redBright(authErrors.badAuthProviderInfo)}`);
                return null;
            }
            SimbaConfig.log.debug(`${chalk.cyanBright(`\nsimba: _authProviderInfo: ${JSON.stringify(_authProviderInfo)}`)}`)
            if (!_authProviderInfo) {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: no auth provider info detected.`)}`)
            }
            let authProviderType = _authProviderInfo.type;
            switch(authProviderType) {
                case AuthProviders.KEYCLOAK: { 
                    this._authStore = new KeycloakHandler(this._configStore, this._projectConfigStore);
                    break; 
                }
                case AuthProviders.KEYCLOAKOAUTH2: {
                    this._authStore = new KeycloakHandler(this._configStore, this._projectConfigStore);
                    break; 
                }
                case AuthProviders.AZUREB2C: {
                    this._authStore = new AzureHandler(this._configStore, this._projectConfigStore);
                    break;
                }
                default: { 
                   SimbaConfig.log.error(`${chalk.redBright(`\nsimba: a valid auth provider was not found. Deleting authProviderInfo from simba.json. Please make sure your 'baseURL' field is properly set in your simba.json and try again.`)}`);
                   SimbaConfig.deleteAuthProviderInfo();
                   break; 
                } 
            }
        }
        SimbaConfig.log.debug(`:: EXIT :`);
        return this._authStore;
    }

    public async authStore(): Promise<KeycloakHandler | AzureHandler | null> {
        return await SimbaConfig.authStore();
    }

    public static allDirs(): Record<any, any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const dirs = {
            buildDirectory: SimbaConfig.buildDirectory,
            contractDirectory: SimbaConfig.contractDirectory,
            artifactDirectory: SimbaConfig.artifactDirectory,
        }
        SimbaConfig.log.debug(`:: EXIT : dirs : ${JSON.stringify(dirs)}`);
        return dirs;
    }

    public allDirs(): Record<any, any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return SimbaConfig.allDirs();
    }

    public static printChalkedDirs(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        SimbaInfo.printChalkedObject(SimbaConfig.allDirs(), "simba directories");
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    public printChalkedDirs(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        SimbaConfig.printChalkedDirs();
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    /**
     * to determine where compiled contracts are stored
     */
    public static get artifactDirectory(): string {
        let artifactPath = this.ProjectConfigStore.get("artifactDirectory");
        if (artifactPath) {
            this.log.debug(`${chalk.cyanBright(`simba: artifactDirectory path obtained from simba.json. If you wish to have Simba obtain your artifacts from the default location for your web3 project, then please remove the 'artifactDirectory' field from simba.json.`)}`)
            return artifactPath;
        }
        const web3Suite = this.ProjectConfigStore.get("web3Suite") ?
            this.ProjectConfigStore.get("web3Suite").toLowerCase() :
            this.ProjectConfigStore.get("web3suite").toLowerCase();
        switch(web3Suite) {
            case WebThreeSuites.HARDHAT: {
                artifactPath =  path.join(cwd(), CompiledDirs.ARTIFACTS)
                break; 
            }
            case WebThreeSuites.TRUFFLE: {
                artifactPath =  path.join(cwd(), CompiledDirs.BUILD)
                break;
            }
            default: { 
               SimbaConfig.log.error(`${chalk.redBright(`simba: ERROR : "web3Suite" not defined in simba.json. Please specify as "hardhat", "truffle", etc.`)}`)
               break; 
            } 
         }
         return artifactPath;
    }

    public get artifactDirectory(): string {
        return SimbaConfig.artifactDirectory;
    }

    public static setDirectory(dirName: AllDirs, dirPath: string): void {
        const entryParams = {
            dirName,
            dirPath,
        };
        SimbaConfig.log.debug(`:: ENTER : entryParmas : ${JSON.stringify(entryParams)}`);
        switch (dirName) {
            case (AllDirs.ARTIFACTDIRECTORY): {
                SimbaConfig.artifactDirectory = dirPath;
                break;
            }
            case (AllDirs.BUILDDIRECTORY): {
                SimbaConfig.buildDirectory = dirPath;
                break;
            }
            case (AllDirs.CONTRACTDIRECTORY): {
                SimbaConfig.contractDirectory = dirPath;
                break;
            }
            default: {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: unrecognized directory name: ${dirName}`)}`);
                return;
            }
        }
    }

    public setDirectory(dirName: AllDirs, dirPath: string): void {
        const entryParams = {
            dirName,
            dirPath,
        };
        SimbaConfig.log.debug(`:: ENTER : entryParmas : ${JSON.stringify(entryParams)}`);
        SimbaConfig.setDirectory(dirName, dirPath);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    public static set artifactDirectory(dirPath: string) {
        SimbaConfig.log.debug(`:: ENTER : dirPath : ${dirPath}`);
        if (dirPath === "reset") {
            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: resetting artifactDirectory to default settings`)}`);
            SimbaConfig.ProjectConfigStore.delete("artifactDirectory");
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: setting artifactDirectory to ${dirPath}`)}`);
        SimbaConfig.ProjectConfigStore.set("artifactDirectory", dirPath);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    public set artifactDirectory(dirPath: string) {
        SimbaConfig.log.debug(`:: ENTER : dirPath : ${dirPath}`);
        SimbaConfig.artifactDirectory = dirPath;
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    /**
     * used for Hardhat, since some build info is stored in separate file from main artifact info
     */
    public static get buildInfoDirectory(): string {
        return path.join(SimbaConfig.artifactDirectory, "build-info");
    }

    public get buildInfoDirectory(): string {
        return SimbaConfig.buildInfoDirectory;
    }

    public static get buildDirectory(): string {
        let buildDir = this.ProjectConfigStore.get("buildDirectory");
        if (buildDir) {
            this.log.debug(`${chalk.cyanBright(`simba: buildDirectory path obtained from simba.json. If you wish to have Simba obtain your build artifacts from the default location for your web3 project, then please remove the 'buildDirectory' field from simba.json.`)}`);
            return buildDir;
        }
        return path.join(SimbaConfig.artifactDirectory, "contracts");
    }

    public get buildDirectory(): string {
        return SimbaConfig.buildDirectory;
    }

    public static set buildDirectory(dirPath: string) {
        SimbaConfig.log.debug(`:: ENTER : dirPath : ${dirPath}`);
        if (dirPath.toLowerCase() === "reset") {
            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: resetting buildDirectory to default settings`)}`);
            SimbaConfig.ProjectConfigStore.delete("buildDirectory");
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: setting buildDirectory to ${dirPath}`)}`);
        SimbaConfig.ProjectConfigStore.set("buildDirectory", dirPath);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    public set buildDirectory(dirPath: string) {
        SimbaConfig.log.debug(`:: ENTER : dirPath : ${dirPath}`);
        SimbaConfig.buildDirectory = dirPath;
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    /**
     * not used in standard flow
     */
    public static get contractDirectory(): string {
        let contractDir = this.ProjectConfigStore.get("contractDirectory");
        if (contractDir) {
            this.log.debug(`${chalk.cyanBright(`simba: contractDirectory path obtained from simba.json. If you wish to have Simba obtain your build artifacts from the default location for your web3 project, then please remove the 'contractDirectory' field from simba.json.`)}`);
            return contractDir;
        }
        contractDir = path.join(cwd(), 'contracts');
        if (!fs.existsSync(contractDir)) {
            fs.mkdirSync(contractDir, { recursive: true });
        }
        return path.join(cwd(), 'contracts');
    }

    public get contractDirectory(): string {
        return SimbaConfig.contractDirectory;
    }

    public static set contractDirectory(dirPath: string) {
        SimbaConfig.log.debug(`:: ENTER : dirPath : ${dirPath}`);
        if (dirPath.toLowerCase() === "reset") {
            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: resetting contractDirectory to default settings`)}`);
            SimbaConfig.ProjectConfigStore.delete("contractDirectory");
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: setting contractDirectory to ${dirPath}`)}`);
        SimbaConfig.ProjectConfigStore.set("contractDirectory", dirPath);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    }

    public set contractDirectory(dirPath: string) {
        SimbaConfig.log.debug(`:: ENTER : dirPath : ${dirPath}`);
        SimbaConfig.contractDirectory = dirPath;
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    /**
     * used to determine whether we're using Hardhat, Truffle, etc.
     * this field should be stored in simba.json at beginning of each project
     */
    public static get web3Suite(): string {
        return this.ProjectConfigStore.get('web3Suite');
    }

    public get web3Suite(): string {
        return SimbaConfig.web3Suite;
    }

    public static set web3Suite(_w3Suite: string) {
        this.ProjectConfigStore.set('web3Suite', _w3Suite);
    }
    
    public set web3Suite(_w3Suite: string) {
        SimbaConfig.web3Suite = _w3Suite;
    }

    /**
     * this is what we use for logging throughout our plugins
     */
    public static get log(): Logger {
        const logLevel = SimbaConfig.logLevel;
        const logger: Logger = new Logger({minLevel:logLevel});
        return logger;
    }

    public get log(): Logger {
        return SimbaConfig.log;
    }

    /**
     * how we get loglevel throughout our plugins
     */
    public static get logLevel(): LogLevel {
        let logLevel = this.ProjectConfigStore.get('logLevel') ? 
        this.ProjectConfigStore.get('logLevel').toLowerCase() :
        LogLevel.INFO;
        if (!Object.values(LogLevel).includes(logLevel)) {
            logLevel = LogLevel.INFO;
        }
        return logLevel;
    }

    public get logLevel(): LogLevel {
        return SimbaConfig.logLevel;
    }

    /**
     * how we set loglevel throughout our plugins
     */
    public static set logLevel(level: LogLevel) {
        const lowerLevel = level.toLowerCase() as any;
        if (!Object.values(LogLevel).includes(lowerLevel)) {
            this.log.error(`${chalk.redBright(`simba: log level can only be one of: 'error', 'debug', 'info', 'warn', 'fatal', 'silly', 'trace'`)}`);
            return
        }
        this.ProjectConfigStore.set("logLevel", lowerLevel);
    }

    public set logLevel(level: LogLevel) {
        SimbaConfig.logLevel = level;
    }

    /**
     * view organisation from our simba.json
     */
    public static get organisation(): any {
        const org = this.ProjectConfigStore.get('organisation') ? this.ProjectConfigStore.get('organisation') : this.ProjectConfigStore.get('organization');
        return org;
    }

    public get organisation(): any {
        return SimbaConfig.organisation;
    }

    public static set organisation(org: any) {
        this.ProjectConfigStore.set('organisation', org);
    }

    public set organisation(org: any) {
        SimbaConfig.organisation = org;
    }

    /**
     * view application from our simba.json
     */
    public static get application(): any {
        return this.ProjectConfigStore.get('application');
    }

    public get application(): any {
        return SimbaConfig.application;
    }

    public static set application(app: any) {
        this.ProjectConfigStore.set('application', app);
    }

    public set application(app: any) {
        SimbaConfig.application = app;
    }
}