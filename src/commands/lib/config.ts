import * as fs from "fs";
import {
    LogLevel,
} from "./logger";
import {
    Logger,
} from "tslog";
import {cwd} from 'process';
import * as dotenv from "dotenv";
import * as path from 'path';
import * as os from "os";
import Configstore from 'configstore';
import {
    KeycloakHandler,
    AuthProviders,
    authErrors,
} from './authentication';
import {
    discoverAndSetWeb3Suite,
    web3SuiteErrorMessage,
    buildURL,
} from "../lib";
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
    AUTHENDPOINT = "ENDPOINT",
    BASE_URL = "BASE_URL",
}

enum SimbaEnvFiles {
    DOT_SIMBACHAIN_DOT_ENV = ".simbachain.env",
    SIMBACHAIN_DOT_ENV = "simbachain.env",
    DOT_ENV = ".env",
}

// for ordered iteration purposes
export const simbaEnvFilesArray = [
    SimbaEnvFiles.DOT_SIMBACHAIN_DOT_ENV,
    SimbaEnvFiles.SIMBACHAIN_DOT_ENV,
    SimbaEnvFiles.DOT_ENV,
]

const SIMBA_HOME = process.env.SIMBA_HOME || os.homedir();

/**
 * appends /auth onto end of baseurl for authinfo for AuthProviders.KEYCLOAKOAUTH2
 * @param authInfo 
 * @returns 
 */
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
 * the two main files SimbaConfig manipulates and reads from are simba.json and authconfig.json
 * 
 * If you notice throughout this class, many methods are defined in static
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
    public static _authStore: KeycloakHandler;
    public static _application: any;
    public static _organisation: any;
    public static _build_directory: string;
    public static _log: Logger;
    public static envVars: Record<any, any> = {}; // do stuff with this...

    /**
     *  many of these instance properties are not actually uses
     *  they're just defined here for debugging/logging purposes
     */
    public constructor() {
        const confstore = this.ConfigStore;
        const projconfstore = this.ProjectConfigStore;
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
            buildDir,
            logLevel,
        }
        SimbaConfig.log.debug(`:: ENTER : SimbaConfig constructor params : ${JSON.stringify(constructorParams)}`)

    }

    /**
     * handles our auth / access token info - currently authconfig.json
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

    /**
     * looks for baseURL in simba.json
     * @returns {string | void}
     */
    private static retrieveBaseAPIURLFromConfigStore(): string | void {
        SimbaConfig.log.debug(":: ENTER :");
        const fullKey = "SIMBA_API_BASE_URL";
        let val = SimbaConfig.ProjectConfigStore.get("baseURL") ||
            SimbaConfig.ProjectConfigStore.get("baseUrl") ||
            SimbaConfig.ProjectConfigStore.get("baseurl") ||
            SimbaConfig.ProjectConfigStore.get(fullKey);
        if (val) {
            SimbaConfig.log.debug(`:: EXIT : ${val}`);
            return val;
        }
        SimbaConfig.log.debug(":: EXIT :");
    }

    /**
     * looks for SIMBA_API_BASE_URL in env vars
     * first looks in local project (.simbachain.env, simbachain.env, .env)
     * then looks in SIMBA_HOME location, iterating through those same file names
     * @returns {string | void}
     */
    private static retrieveBaseAPIURLFromEnvVars(): string | void {
        // first check local project
        SimbaConfig.log.debug(":: ENTER :");
        const fullKey = "SIMBA_API_BASE_URL";
        for (let i = 0; i < simbaEnvFilesArray.length; i++) {
            const fileName = simbaEnvFilesArray[i];
            dotenv.config({
                override: true,
                path: path.resolve(cwd(), fileName),
            });
            const val = process.env[fullKey];
            if (val) {
                SimbaConfig.log.debug(`:: EXIT : ${val}`);
                return val;
            }
        }

        // now we check SIMBA_HOME directory
        for (let i = 0; i < simbaEnvFilesArray.length; i++) {
            const fileName = simbaEnvFilesArray[i];
            dotenv.config({
                override: true,
                path: path.resolve(SIMBA_HOME, fileName),
            });
            const val = process.env[fullKey];
            if (val) {
                SimbaConfig.log.debug(`:: EXIT : ${val}`);
                return val;
            }
        }
        SimbaConfig.log.debug(":: EXIT :");
    }

    /**
     * checks simba.json first, then looks for env vars
     * @returns {string}
     */
    public static retrieveBaseAPIURL(): string {
        SimbaConfig.log.debug(":: ENTER :");
        let baseURL = this.retrieveBaseAPIURLFromConfigStore();
        if (baseURL) {
            SimbaConfig.log.debug(`:: EXIT : ${baseURL}`);
            return baseURL;
        }

        baseURL = this.retrieveBaseAPIURLFromEnvVars();
        if (baseURL) {
            SimbaConfig.log.debug(`:: EXIT : ${baseURL}`);
            return baseURL;
        }

        const message = `Unable to locate a value for either SIMBA_API_BASE_URL or baseURL. We check in the following places:\n1. simba.json for either SIMBA_API_BASE_URL or baseURL\n2. local project root for SIMBA_API_BASE_URL in: .simbachain.env, simbachain.env, or .env\n3. SIMBA_HOME for SIMBA_API_BASE_URL in .simbachain.env, simbachain.env, or .env. If you want to use SIMBA_HOME, then set a desired directory as SIMBA_HOME in your system's environment variables. Then within that specified directory, create one of .simbachain.env, simbachain.env, or .env, and then set SIMBA_API_BASE_URL=<YOUR BASE URL>\n`
        SimbaConfig.log.error(`:: EXIT : ${chalk.redBright(`${message}`)}`);
        throw new Error(message);
    }

    /**
     * this method only gets called once, when a process first tries to retrieve an env var
     * if SimbaConfig.envVars's values is zero length, then we call this method
     * 
     * The code is a bit convoluted, so here's the process:
     * 1. iterate through file names of (.simbachain.env, simbachain.env, .env) in our project root
     * 2. we then loop through each of our simba keys:"ID", "SECRET", "ENDPOINT", and "BASE_URL"
     * 3. for each one of those keys, we search for `SIMBA_AUTH_CLIENT_${key}`
     * 4. once we have found a value for "ID", "SECRET", "ENDPOINT", and "BASE_URL", based on the above keys that users can actually set (in 3), we return them and set them as SimbaConfig.envVars
     * 5. we then run through 1-4 again, but we use SIMBA_HOME instead of project root
     * @returns {Promise<Record<any, any>>}
     */
    public static setEnvVars(): Record<any, any> {
        SimbaConfig.log.debug(`:: ENTER :`);

        const foundKeys: Array<any> = [];
        // the following shouldn't need to be changed
        // has to do with whether authendpoint should be configured, but
        // for now this is fine
        foundKeys.push("SIMBA_AUTH_CLIENT_ENDPOINT");
        SimbaConfig.envVars["SIMBA_AUTH_CLIENT_ENDPOINT"] = "/o/";

        // first iterate through local project
            // through each file name
                // if we have found all our keys, return our object
        for (let i = 0; i < simbaEnvFilesArray.length; i++) {
            if (foundKeys.length === Object.values(EnvVariableKeys).length) {
                SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(SimbaConfig.envVars)}`)
                return SimbaConfig.envVars;
            }
            const fileName = simbaEnvFilesArray[i];
            dotenv.config({
                override: true,
                path: path.resolve(cwd(), fileName),
            });

            for (let j = 0; j < Object.values(EnvVariableKeys).length; j++) {
                const envVarKey = Object.values(EnvVariableKeys)[j];
                if (envVarKey in foundKeys) {
                    continue;
                }
                const simbaKey = `SIMBA_AUTH_CLIENT_${envVarKey}`;
                const val = process.env[simbaKey];

                if (val) {
                    SimbaConfig.envVars[simbaKey] = val;
                    foundKeys.push(envVarKey)
                }
            }
        }

        // now same thing in SIMBA_HOME
        for (let i = 0; i < simbaEnvFilesArray.length; i++) {
            if (foundKeys.length === Object.values(EnvVariableKeys).length) {
                SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(SimbaConfig.envVars)}`)
                return SimbaConfig.envVars;
            }
            const fileName = simbaEnvFilesArray[i];
            dotenv.config({
                override: true,
                path: path.resolve(SIMBA_HOME, fileName),
            });

            for (let j = 0; j < Object.values(EnvVariableKeys).length; j++) {
                const envVarKey = Object.values(EnvVariableKeys)[j];
                if (envVarKey in foundKeys) {
                    continue;
                }
                const simbaKey = `SIMBA_AUTH_CLIENT_${envVarKey}`;
                const val = process.env[simbaKey];
                if (val) {
                    SimbaConfig.envVars[simbaKey] = val;
                    foundKeys.push(envVarKey)
                }

            }
        }

        SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(SimbaConfig.envVars)}`);
        return SimbaConfig.envVars;
    }

    /**
     * retrieves value for env var key. looks for:
     * `SIMBA_AUTH_CLIENT_${envVarKey}`
     * 
     * if SimbaConfig.envVars values has zero length, we first call SimbaConfig.setEnvVars
     * @param envVarKey
     * @returns 
     */
    public static retrieveEnvVar(envVarKey: EnvVariableKeys): string | void {
        let envVars;
        if (!Object.values(SimbaConfig.envVars).length) {
            envVars = SimbaConfig.setEnvVars();
        } else {
            envVars = SimbaConfig.envVars;
        }

        const simbaKey = `SIMBA_AUTH_CLIENT_${envVarKey}`;
        const val = envVars[simbaKey];
        if (val) {
            SimbaConfig.log.debug(`:: EXIT : ${envVarKey} : ${val}`);
            return val;
        }

        const message = `Unable to find value for ${simbaKey}. You can set this in one of the following file names: .simbachain.env, simbachain.env, or .env; and these files can live in your local project root (best option) or in the directory that SIMBA_HOME points to in your system env vars.`
        SimbaConfig.log.error(`${chalk.redBright(`:: EXIT : ${message}`)}`);
        throw new Error(message);
    }

    public async retrieveEnvVar(envVarKey: EnvVariableKeys): Promise<string | void> {
        SimbaConfig.log.debug(`:: ENTER : envVarKey : ${envVarKey}`);
        const val = SimbaConfig.retrieveEnvVar(envVarKey);
        SimbaConfig.log.debug(`:: EXIT : `);
        return val;
    }

    /**
     * this method is used in the plugins to reset simba.json, but with more control over what exactly gets reset
     * @param previousSimbaJson 
     * @param newOrg 
     * @param forceReset - basically wipes all of simba.json if true, dependent on value of keepOrgAndApp
     * @param keepOrgAndApp 
     * @returns 
     */
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
            SimbaConfig.log.debug(`\nsimba: ${previousOrgName} === ${newOrgName}; not switching orgs, no action needed`);
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
    }

    /**
     * used to delete field in simba.json
     * @param key 
     */
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

    /**
     * deletes authProviderInfo in simba.json
     */
    public static deleteAuthProviderInfo() {
        SimbaConfig.log.debug(`:: ENTER :`);
        const key = "authProviderInfo";
        SimbaConfig.deleteSimbaJsonField(key);
    }

    public deleteAuthProviderInfo() {
        SimbaConfig.deleteAuthProviderInfo();
    }

    /**
     * retrieves and sets authProviderInfo in simba.json, based on our baseAPI (or SIMBA)AUTH_CLIENT_ID or other iteration of key)
     * @returns {Promise<any>}
     */
    public static async setAndGetAuthProviderInfo(): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (!SimbaConfig.ProjectConfigStore.get("authProviderInfo")) {
            const baseURL = SimbaConfig.retrieveBaseAPIURL();
            if (!baseURL) {
                SimbaConfig.log.error(`${chalk.redBright(`${authErrors.noBaseURLError}`)}`);
                throw new Error(authErrors.noBaseURLError);
            }
            const authInfoURL = buildURL(baseURL, "/authinfo");
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
                    if (error.response.status == 404) {
                        SimbaConfig.log.error(`${chalk.redBright(`\n:: EXIT : received 404 response for url ${authInfoURL}.`)}` );
                    } else {
                        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : messsage: ${JSON.stringify(error.response.data)}`)}`)
                    }
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
                }
                return;
            } 
                
        }
        return SimbaConfig.ProjectConfigStore.get("authProviderInfo");
    }

    /**
     * currently only returns KeycloakHandler, since we no longer use AzureHandler
     * @returns {Promise<KeycloakHandler | null>}
     */
    public static async authStore(): Promise<KeycloakHandler | null> {
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
                default: { 
                   SimbaConfig.log.error(`${chalk.redBright(`\nsimba: a valid auth provider was not found. Deleting authProviderInfo from simba.json. Please make sure your SIMBA_API_BASE_URL is properly configured.`)}`);
                   SimbaConfig.deleteAuthProviderInfo();
                   break; 
                } 
            }
        }
        SimbaConfig.log.debug(`:: EXIT :`);
        return this._authStore;
    }

    public async authStore(): Promise<KeycloakHandler | null> {
        return await SimbaConfig.authStore();
    }

    /**
     * if user has modified build, contract, artifact directory for their project,
     * then it grabs these and returns them from simba.json
     * @returns {Record<any, any>}
     */
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

    /**
     * prints chalked directories
     */
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
     * to determine where compiled contracts are stored, based on web3Suite (hardhat, truffle, etc.)
     * @returns {string}
     */
    public static get artifactDirectory(): string {
        SimbaConfig.log.debug(":: ENTER :");
        let artifactPath = this.ProjectConfigStore.get("artifactDirectory");
        if (artifactPath) {
            this.log.debug(`${chalk.cyanBright(`simba: artifactDirectory path obtained from simba.json. If you wish to have Simba obtain your artifacts from the default location for your web3 project, then please remove the 'artifactDirectory' field from simba.json.`)}`)
            return artifactPath;
        }
        const web3Suite = discoverAndSetWeb3Suite();
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
               SimbaConfig.log.error(web3SuiteErrorMessage);
               break; 
            } 
         }
         return artifactPath;
    }

    public get artifactDirectory(): string {
        return SimbaConfig.artifactDirectory;
    }

    /**
     * allows user to override default directories for build, contract, artifact, etc.
     * @param dirName 
     * @param dirPath 
     * @returns {void}
     */
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

    /**
     * setter for artifactDirectory in simba.json
     */
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
        SimbaConfig.log.debug(":: ENTER :");
        return path.join(SimbaConfig.artifactDirectory, "build-info");
    }

    public get buildInfoDirectory(): string {
        return SimbaConfig.buildInfoDirectory;
    }

    /**
     * getter for buildDirectory
     * @returns {string}
     */
    public static get buildDirectory(): string {
        SimbaConfig.log.debug(":: ENTER :");
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

    /**
     * setter for buildDirectory in simba.json
     */
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
     * getter for contractDirectory
     * Not used in standard flow, since users shouldn't typically modify this value
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

    /**
     * setter for contractDirectory in simba.json
     */
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
     * this is what we use for logging throughout our plugins
     * @returns {Logger}
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
     * @returns {LogLevel}
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
     * getter for organisation from our simba.json
     */
    public static get organisation(): any {
        const org = this.ProjectConfigStore.get('organisation') ? this.ProjectConfigStore.get('organisation') : this.ProjectConfigStore.get('organization');
        return org;
    }

    public get organisation(): any {
        return SimbaConfig.organisation;
    }

    /**
     * setter for organisation in simba.json
     */
    public static set organisation(org: any) {
        this.ProjectConfigStore.set('organisation', org);
    }

    public set organisation(org: any) {
        SimbaConfig.organisation = org;
    }

    /**
     * getter for application in simba.json
     * @returns {any}
     */
    public static get application(): any {
        return this.ProjectConfigStore.get('application');
    }

    public get application(): any {
        return SimbaConfig.application;
    }

    /**
     * setter for application in simba.json
     */
    public static set application(app: any) {
        this.ProjectConfigStore.set('application', app);
    }

    public set application(app: any) {
        SimbaConfig.application = app;
    }
}
