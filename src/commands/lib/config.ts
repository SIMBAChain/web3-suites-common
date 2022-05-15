// import {
//     log,
// } from "../lib";
import {
    LogLevel,
} from "./logger";
import {
    Logger,
} from "tslog";
import {cwd} from 'process';
import * as path from 'path';
import Configstore from 'configstore';
import {KeycloakHandler} from './authentication';
import {default as chalk} from 'chalk';
// const fsPromises = require("fs").promises;


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

    public constructor() {
        // these instance properties are not actually uses
        // they're just defined here for debugging/logging purposes
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
        log.debug(`:: ENTER : SimbaConfig constructor params : ${JSON.stringify(constructorParams)}`)

    }

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

    public static get authStore(): KeycloakHandler {
        SimbaConfig.log.debug(`:: ENTER :`)
        if (!this._authStore) {
            SimbaConfig.log.debug(`:: instantiating new authStore`);
            this._authStore = new KeycloakHandler(this._configStore, this._projectConfigStore);
        }
        SimbaConfig.log.debug(`:: EXIT :`);
        return this._authStore;
    }

    public get authStore(): KeycloakHandler {
        return SimbaConfig.authStore;
    }

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
            case "hardhat": {
                artifactPath =  path.join(cwd(), 'artifacts')
                break; 
            }
            case "truffle": {
                artifactPath =  path.join(cwd(), 'build')
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

    public static get buildInfoDirectory(): string {
        return SimbaConfig.artifactDirectory + "/build-info";
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
        return SimbaConfig.artifactDirectory + "/contracts";
    }

    public get buildDirectory(): string {
        return SimbaConfig.buildDirectory;
    }

    public static get contractDirectory(): string {
        const contractDir = this.ProjectConfigStore.get("contractDirectory");
        if (contractDir) {
            this.log.debug(`${chalk.cyanBright(`simba: contractDirectory path obtained from simba.json. If you wish to have Simba obtain your build artifacts from the default location for your web3 project, then please remove the 'contractDirectory' field from simba.json.`)}`);
            return contractDir;
        }
        return path.join(cwd(), 'contracts');
    }

    public get contractDirectory(): string {
        return SimbaConfig.contractDirectory;
    }

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

    public static get log(): Logger {
        const logLevel = SimbaConfig.logLevel;
        const logger: Logger = new Logger({minLevel:logLevel});
        return logger;
    }

    public get log(): Logger {
        return SimbaConfig.log;
    }

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

    public static set logLevel(level: LogLevel) {
        const lowerLevel = level.toLocaleLowerCase() as any;
        if (!Object.values(LogLevel).includes(lowerLevel)) {
            this.log.error(`${chalk.redBright(`simba: log level can only be one of: 'error', 'debug', 'info', 'warn', 'fatal', 'silly', 'trace'`)}`);
            return
        }
        this.ProjectConfigStore.set("logLevel", lowerLevel);
    }

    public set logLevel(level: LogLevel) {
        SimbaConfig.logLevel = level;
    }

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