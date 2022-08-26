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
import axios, {AxiosResponse} from "axios";
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

export const AUTHKEY = 'SIMBAAUTH';

interface PollingConfig {
    maxAttempts: number;
    interval: number;
}

export enum AuthProviders {
    KEYCLOAK = "keycloak",
    KEYCLOAKOAUTH2 = "KeycloakOAuth2",
    AZUREB2C = "azureb2c",
};

interface KeycloakDeviceVerificationInfo {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    expires_at?: number;
    interval: number;
}

interface AuthErrors {
    headersError: string;
    keycloakCertsError: string;
    verificationInfoError: string;
    authTokenError: string;
    noClientIDError: string;
    noBaseURLError: string;
    noAuthURLError: string;
    noRealmError: string;
    badAuthProviderInfo: string;
}

const SIMBAERROR = "SIMBAERROR";

export const authErrors: AuthErrors = {
    headersError: `${chalk.red('simba: Error acquiring auth headers. Please make sure your OAuth provider certs are not expired.')}`,
    keycloakCertsError: `${chalk.red('simba: Error obtaining auth creds. Please make sure your OAuth provider certs are not expired.')}`,
    verificationInfoError: `${chalk.red('simba: Error acquiring verification info. Please make sure OAuth provider certs are not expired.')}`,
    authTokenError: `${chalk.red('simba: Error acquiring auth token. Please make sure OAuth provider certs are not expired')}`,
    noClientIDError: `${chalk.red('simba: Error acquiring clientID. Please make sure "clientID" is configured correctly for your OAuth provider')}`,
    noBaseURLError: `${chalk.red('simba: Error acquiring baseURL. Please make sure "baseURL" is configured in simba.json')}`,
    noAuthURLError: `${chalk.red('simba: Error acquiring authURL. Please make sure "authURLID" is configured in simba.json')}`,
    noRealmError: `${chalk.red('simba: Error acquiring realm. Please make sure "realm" is configured in simba.json')}`,
    badAuthProviderInfo: `${chalk.red('simba: Error acquiring auth provider info. This may be due to a bad "baseURL" value. Please check that your "baseURL" field is properly set in your simba.json')}`,
}

interface KeycloakAccessToken {
    access_token: string;
    expires_in: number;
    expires_at?: number;
    refresh_expires_in: number;
    refresh_expires_at: number;
    refresh_token: string;
    token_type: string;
    not_before_policy: number;
    session_state: string;
    scope: string;
}

interface ClientCredsToken {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
    retrieved_at?: string;
    expires_at: number;
}

function addSlashToURL(baseURL: string): string {
    return baseURL.endsWith("/") ? baseURL : `${baseURL}/`
}

/**
 * This class handles our login for keycloak device login
 * In the future, when we decide to introduce other auth flows,
 * then we should have a similar class for other auth flows
 */
export class KeycloakHandler {
    private config: Configstore;
    private projectConfig: Configstore;
    private baseURL: string;
    private verificationInfo: KeycloakDeviceVerificationInfo;
    private configBase: string;
    private authErrors: AuthErrors;
    private _loggedIn: boolean;
    constructor(
        config?: Configstore,
        projectConfig?: Configstore,
        tokenExpirationPad: number = 60,
    ) {
        this.authErrors = authErrors;
        this.config = SimbaConfig.ConfigStore;
        this.projectConfig = SimbaConfig.ProjectConfigStore;
        this.baseURL = this.projectConfig.get('baseURL') ? this.projectConfig.get('baseURL') : this.projectConfig.get('baseUrl');
        if (!this.baseURL) {
            SimbaConfig.log.error(`:: ${this.authErrors.noBaseURLError}`);
        }
        this.configBase = this.baseURL.split(".").join("_");
    }

    /**
     * To be compatible with AzureHandler
     */
    public async performLogin(
        interactive: boolean = true,
        ): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER : interactive : ${interactive}`);
        const authToken = await this.loginAndGetAuthToken(false, interactive);
        SimbaConfig.log.debug(`:: EXIT :`);
        return authToken;
    }

    /**
     * used as field for our auth token
     * @returns 
     */
    protected getConfigBase(): string {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (!this.configBase) {
            this.configBase = this.baseURL.split(".").join("_");
        }
        SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(this.configBase)}`);
        return this.configBase;
    }

    /**
     * self explanatory
     * @param status 
     */
    public setLoggedInStatus(status: boolean): void {
        SimbaConfig.log.debug(`:: ENTER : ${status}`);
        this._loggedIn = status;
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    /**
     * used to avoid trying to login in when the process has already begun
     * @returns 
     */
    public isLoggedIn(): boolean {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (this.verificationInfo) {
            SimbaConfig.log.debug(`:: EXIT : ${true}`);
            return true;
        } else {
            SimbaConfig.log.debug(`:: EXIT : ${false}`);
            return false;
        }
    }

    /**
     * deletes our auth info
     */
    public async logout(): Promise<void> {
        SimbaConfig.log.debug(`:: ENTER :`);
        this.setLoggedInStatus(false);
        this.deleteAuthInfo();
        SimbaConfig.deleteAuthProviderInfo();
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    /**
     * deletes auth info
     */
    protected deleteAuthInfo(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (this.config.get(this.configBase)) {
            this.config.set(this.configBase, {});
            SimbaConfig.log.debug(`:: EXIT :`);
        }
    }

    /**
     * not currently used
     * @returns 
     */
    protected getPathToConfigFile(): string {
        SimbaConfig.log.debug(`:: ENTER :`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return this.config.path;
    }

    /**
     * tells us whether a certian key exists in our configstore
     * @param key 
     * @returns 
     */
    protected hasConfig(key: string): boolean {
        SimbaConfig.log.debug(`:: ENTER : ${key}`);
        if (!this.config.has(this.configBase)) {
            SimbaConfig.log.debug(`:: EXIT : ${false}`);
            return false;
        }
        const _hasConfig = key in this.config.get(this.getConfigBase());
        SimbaConfig.log.debug(`:: EXIT : ${_hasConfig}`);
        return _hasConfig;
    }

    /**
     * return config from configstore
     * @param key 
     * @returns 
     */
    protected getConfig(key: string): any {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (!this.config.has(this.configBase)) {
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
        const dict = this.config.get(this.getConfigBase());
        if (!(key in dict)) {
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
        const _config = dict[key];
        SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(_config)}`);
        return _config;
    }

    /**
     * pertains to configstore
     * @param key 
     * @param value 
     * @returns 
     */
    protected getOrSetConfig(key: string, value: any): any {
        const entryParams = {
            key,
            value,
        }
        SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);
        if (!this.hasConfig(key)) {
            this.setConfig(key, value);
            SimbaConfig.log.debug(`:: EXIT :`);
            return value;
        }
        SimbaConfig.log.debug(`:: EXIT :`);
        return this.getConfig(key);
    }

    /**
     * sets config in configstore
     * @param key 
     * @param value 
     * @returns 
     */
    protected setConfig(key: string, value: any): any {
        SimbaConfig.log.debug(`:: ENTER : KEY: ${key}, VALUE: ${JSON.stringify(value)}`);
        if (!this.config.has(this.configBase)) {
            this.config.set(this.configBase, {});
        }
        const dict = this.config.get(this.configBase);
        dict[key] = value;
        this.config.set(this.configBase, dict);
        SimbaConfig.log.debug(`:: EXIT : this.config: ${JSON.stringify(this.config)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return value;
    }

    /**
     * deletes config in configstore
     * @param key 
     * @returns 
     */
    protected deleteConfig(key: string): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (!this.config.has(this.configBase)) {
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
        const dict = this.config.get(this.configBase);
        if (!(key in dict)) {
            SimbaConfig.log.debug(`:: EXIT :`);
            return;
        }
        delete dict[key];
        this.config.set(this.configBase, dict);
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    public parseExpiry(auth: any): any {
        if ('expires_in' in auth) {
            const retrievedAt = new Date();
            const expiresIn = parseInt(auth.expires_in, 10) * 1000;
            const expiresAt = new Date(Date.parse(retrievedAt.toISOString()) + expiresIn);
            auth.retrieved_at = retrievedAt.toISOString();
            auth.expires_at = expiresAt.toISOString();
            if (auth.refresh_expires_in) {
                const refreshExpiresIn = parseInt(auth.refresh_expires_in, 10) * 1000;
                const refreshExpiresAt = new Date(Date.parse(retrievedAt.toISOString()) + refreshExpiresIn);
                auth.refresh_expires_at = refreshExpiresAt.toISOString();
            }
        }
        return auth;
    }

    public async getAndSetAuthTokenFromClientCreds(): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const clientID = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.ID);
        const clientSecret = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.SECRET);
        const authEndpoint = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.AUTHENDPOINT);
        const credential = `${clientID}:${clientSecret}`;
        const utf8EncodedCred = utf8.encode(credential);
        const base64EncodedCred = Buffer.from(utf8EncodedCred).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', "client_credentials");
        const headers = {
            "content-type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache",
            "Authorization": `Basic ${base64EncodedCred}`
        };
        const config = {
            headers,
        };
        try {
            const baseURL = handleV2(`${SimbaConfig.ProjectConfigStore.get("baseURL")}`);
            const url = `${baseURL}${authEndpoint}token/`;
            SimbaConfig.log.debug(`:: url : ${url}`);
            const res = await axios.post(url, params, config);
            let authToken = res.data;
            authToken = this.parseExpiry(authToken);
            this.setConfig(AUTHKEY, authToken);
            SimbaConfig.log.debug(`:: EXIT : authToken: ${JSON.stringify(authToken)}`);
            return authToken;
        } catch (error)  {
            if (axios.isAxiosError(error) && error.response) {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`);
            } else {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            }
            return;
        }
    }

    /**
     * first step in logging in. returns verification info, including a URI,
     * to allow user to login.
     * @returns 
     */
    private async getVerificationInfo(): Promise<KeycloakDeviceVerificationInfo | Error> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const authProviderInfo = await SimbaConfig.setAndGetAuthProviderInfo();
        const realm = authProviderInfo.realm;
        const authURL = authProviderInfo.baseurl;
        const clientID = authProviderInfo.client_id;
        const url = `${authURL}/realms/${realm}/protocol/openid-connect/auth/device`;
        const params = new URLSearchParams();
        params.append('client_id', clientID);
        const headers = {
            'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
        };
        const config = {
            headers: headers,
        }
        try {
            const res = await axios.post(url, params, config);
            const verificationInfo: KeycloakDeviceVerificationInfo = res.data;
            this.verificationInfo = verificationInfo;
            SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(this.verificationInfo)}`);
            return verificationInfo;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
            } else {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            }
            return error as Error;
        }
    }

    /**
     * reads out URI user should navigate to for login
     * @returns 
     */
    public async loginUser(): Promise<void | string> {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (!this.isLoggedIn()) {
            this.verificationInfo = await this.getVerificationInfo() as KeycloakDeviceVerificationInfo;
        }
        const verificationCompleteURI = this.verificationInfo.verification_uri_complete;
        // the following line is where we begin the flow of handling not acquiring verification info
        if (!verificationCompleteURI) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.keycloakCertsError}`)}`);
            return SIMBAERROR;
        }
        SimbaConfig.log.info(`\n${chalk.cyanBright('\nsimba: Please navigate to the following URI to log in: ')} ${chalk.greenBright(verificationCompleteURI)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return verificationCompleteURI;
    }

    /**
     * allows user to login after they have navigated to the URI from loginUser()
     * @param pollingConfig 
     * @param refreshing 
     * @returns 
     */
    public async getAuthToken(
        pollingConfig: PollingConfig = {
            maxAttempts: 60,
            interval: 3000,
        },
        refreshing: boolean = false,
    ): Promise<KeycloakAccessToken | void> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const maxAttempts = pollingConfig.maxAttempts;
        const interval = pollingConfig.interval;
        if (!this.isLoggedIn()) {
            this.verificationInfo = await this.getVerificationInfo() as KeycloakDeviceVerificationInfo;
        }
        if (!this.verificationInfo) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.verificationInfoError}`)}`);
            return;
        }
        const deviceCode = this.verificationInfo.device_code;
        const params = new URLSearchParams();
        const authProviderInfo = await SimbaConfig.setAndGetAuthProviderInfo();
        const realm = authProviderInfo.realm;
        const authURL = authProviderInfo.baseurl;
        const clientID = authProviderInfo.client_id;
        const url = `${authURL}/realms/${realm}/protocol/openid-connect/token`;
        const headers = {
            'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
        };
        const config = {
            headers: headers,
        }
        if (!refreshing) {
            params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
            params.append("client_id", clientID);
            params.append("device_code", deviceCode);
            let attempts = 0;
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, interval));
                try {
                    let response = await axios.post(url, params, config);
                    let authToken: KeycloakAccessToken = response.data
                    authToken = this.parseExpiry(authToken);
                    this.setConfig(AUTHKEY, authToken);
                    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(authToken)}`);
                    return authToken;
                } catch (error) {
                    if (axios.isAxiosError(error) && error.response) {
                        SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: ${JSON.stringify(error.response.data)}`)}`)
                    } else {
                        SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: ${JSON.stringify(error)}`)}`)
                    }
                    if (attempts%5 == 0) {
                        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: still waiting for user to login...`)}`);
                    }
                    attempts += 1;
                }
            }
            SimbaConfig.log.debug(`:: EXIT : attempts exceeded, timedout`);
            return
        } else {
            SimbaConfig.log.debug(`:: entering refresh logic`);
            const authToken = this.getConfig(AUTHKEY);
            SimbaConfig.log.debug(`:: auth : ${JSON.stringify(authToken)}`);
            const _refreshToken = authToken.refresh_token;
            params.append("client_id", clientID);
            params.append("grant_type", "refresh_token");
            params.append("refresh_token", _refreshToken);
            await new Promise(resolve => setTimeout(resolve, interval));
            try {
                let response = await axios.post(url, params, config);
                let newAuthToken: KeycloakAccessToken = response.data;
                newAuthToken = this.parseExpiry(newAuthToken);
                this.setConfig(AUTHKEY, newAuthToken);
                SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(newAuthToken)}`);
                return newAuthToken;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
                }
                return;
            }
        }
    }

    /**
     * checks if auth token is expired. used as a check before we make http call
     * idea is to check for bad token before http call, if possible
     * @returns 
     */
    public tokenExpired(): boolean {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (!this.hasConfig(AUTHKEY)) {
            SimbaConfig.log.debug(`:: EXIT : no authToken exists, exiting with true`);
            return true;
        }
        const authToken = this.getConfig(AUTHKEY);
        if (!authToken.expires_at) {
            SimbaConfig.log.debug(`:: EXIT : true`);
            return true;
        }
        // return true below, to pad for time required for operations
        if (authToken.expires_at <= new Date()) {
            SimbaConfig.log.debug(`:: EXIT : access_token expired, returning true`);
            return true;
        }
        SimbaConfig.log.debug(`:: EXIT : false`);
        return false;
    }

    /**
     * checks if refresh token is expired. used as a check before we make http call
     * idea is to check for bad token before http call, if possible
     * @returns 
     */
    public refreshTokenExpired(): boolean {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (!this.hasConfig(AUTHKEY)) {
            SimbaConfig.log.debug(`:: EXIT : true`);
            return true;
        }
        const authToken = this.getConfig(AUTHKEY);
        if (!authToken.refresh_expires_at) {
            SimbaConfig.log.debug(`:: EXIT : true`);
            return true;
        }
        // return true below, to pad for time required for operations
        if (authToken.refresh_expires_at <= new Date()) {
            SimbaConfig.log.debug(`:: EXIT : refresh_token expired, returning true`);
            return true;
        }
        SimbaConfig.log.debug(`:: EXIT : false`);
        return false;
    }

    /**
     * refresh auth token using refresh token
     * @returns 
     */
    public async refreshToken(): Promise<KeycloakAccessToken | ClientCredsToken | void> {
        SimbaConfig.log.debug(`:: ENTER :`);
        let interactive: boolean = true;
        const currentAuthToken = this.getConfig(AUTHKEY);
        // if there isn't a refresh_token, then it's a client credentials token
        // so we grab a new auth token from client creds
        if (currentAuthToken && !currentAuthToken.refresh_token) {
            interactive = false;
        }
        if (this.refreshTokenExpired()) {
            this.deleteAuthInfo();
            const authToken = await this.loginAndGetAuthToken(false, interactive);
            if (authToken) {
                SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(authToken)}`);
                return authToken;
            } else {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
                return;
            }
        }
        SimbaConfig.log.debug(`:: entering logic to refresh token`);
        const pollingConfig: PollingConfig = {
            maxAttempts: 60,
            interval: 3000,
        };
        const refreshing = true;
        const newAuthToken = await this.getAuthToken(
            pollingConfig,
            refreshing,
        );
        if (newAuthToken) {
            SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(newAuthToken)}`);
            return newAuthToken;
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
            return;
        }
    }

    /**
     * self explanatory
     * @param refreshing 
     * @returns 
     */
    public async loginAndGetAuthToken(
        refreshing: boolean = false,
        interactive: boolean = true,
    ): Promise<KeycloakAccessToken | ClientCredsToken | void> {
        SimbaConfig.log.debug(`:: ENTER :`);
        let verificationCompleteURI;
        if (!interactive) {
            const authToken = await this.getAndSetAuthTokenFromClientCreds();
            SimbaConfig.log.debug(`:: EXIT :`);
            return authToken;
        }
        if (!refreshing) {
            this.logout();
            verificationCompleteURI = await this.loginUser();
        }
        // below we are checking to make sure that SIMBERROR was not returned from loginuser
        if (verificationCompleteURI !== SIMBAERROR) {
            const pollingConfig: PollingConfig = {
                maxAttempts: 60,
                interval: 3000,
            };
            const authToken = await this.getAuthToken(pollingConfig, refreshing) as KeycloakAccessToken;
            SimbaConfig.log.debug(`:: EXIT : authToken : ${JSON.stringify(authToken)}`);
            this.setLoggedInStatus(true);
            return authToken;
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: :: EXIT : ${this.authErrors.verificationInfoError}`)}`);
            return;
        }
    }

    /**
     * returns headers with access token
     * @returns 
     */
    public async accessTokenHeader(): Promise<Record<any, any> | void> {
        SimbaConfig.log.debug(`:: ENTER :`);
        let authToken = this.getConfig(AUTHKEY);
        if (!authToken) {
            authToken = await this.loginAndGetAuthToken(false);
        }
        if (authToken) {
            const accessToken = authToken.access_token;
            const headers = {
                Authorization: `Bearer ${accessToken}`,
            };
            SimbaConfig.log.debug(`:: EXIT : headers: ${JSON.stringify(headers)}`);
            return headers;
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
            return;
        }
    }

    /**
     * combines URL paths while checking for "v2" at end of first path, since this is a common mistake (double v2s)
     * @param urlExtension 
     * @returns 
     */
    public buildURL(
        urlExtension: string,
    ): string {
        SimbaConfig.log.debug(`:: ENTER : ${urlExtension}`);
        if (urlExtension.startsWith("http")) {
            SimbaConfig.log.debug(`:: EXIT : ${urlExtension}`);
            return urlExtension;
        }
        let baseURL = this.baseURL.endsWith("/") ? this.baseURL : this.baseURL + "/";
        baseURL = baseURL.endsWith("v2/") ? baseURL : baseURL.slice(0, -1) + "v2/";
        const fullURL = baseURL + urlExtension;
        SimbaConfig.log.debug(`:: EXIT : ${fullURL}`);
        return fullURL;
    }

    /**
     * make get request. uses axios library
     * @param url 
     * @param contentType 
     * @param _queryParams 
     * @param _buildURL 
     * @returns 
     */
    public async doGetRequest(
        url: string,
        contentType?: string,
        _queryParams?: Record<any, any>,
        _buildURL: boolean = true,
    ): Promise<Record<any, any> | Error | void> {
        const funcParams = {
            url,
            _queryParams,
            contentType,
        }
        SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
        const authProviderInfo = await SimbaConfig.setAndGetAuthProviderInfo();
        const clientID = authProviderInfo.client_id;
        if (this.tokenExpired()) {
            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: auth token expired`)}`)
            if (this.refreshTokenExpired()) {
                SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refresh token expired, acquiring new auth token`)}`);
                const authToken = await this.loginAndGetAuthToken();
                if (!authToken) {
                    SimbaConfig.log.error(`${chalk.red(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
                    return new Error(`${this.authErrors.authTokenError}`);
                }
            } else {
                SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refreshing token`)}`);
                const newAuthToken = await this.refreshToken();
                if (!newAuthToken) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`)
                    SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: there was an error with your request, please log out and then login again, then try your request again`)}`);
                    return
                }
            }
        }
        const queryParams = _queryParams ? _queryParams : {};
        const headers = await this.accessTokenHeader();
        if (headers) {
            if (!contentType) {
                headers["content-type"] = "application/json";
            } else {
                headers["content-type"] = contentType;
            }
            const params = new URLSearchParams();
            params.append('client_id', clientID);
            for (const [key, value] of Object.entries(queryParams)) {
                params.append(key, value);
            }
            const config = {
                headers: headers,
            }
            try {
                if (_buildURL) {
                    url = this.buildURL(url);
                }
                const res = await axios.get(url, config);
                const resData: Record<any, any> = res.data;
                SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(resData)}`);
                return resData;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(error.response.data)}`)}`)
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(error)}`)}`);
                }
                SimbaConfig.log.debug(`err: ${JSON.stringify(error)}`);
                if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
                    SimbaConfig.log.debug(`:: received 401 response, attempting to refresh token`);
                    // if 401 from Simba, then try refreshing token.
                    try {
                        const newAuthToken = await this.refreshToken();
                        if (newAuthToken) {
                            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: new token acquired. Please try your request again`)}`)
                            return;
                        } else {
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: there was a problem acquiring your access token. Please log out and then login and then try your request again`)}`);
                            return;
                        }
                    } catch (e) {
                        if (axios.isAxiosError(e) && e.response) {
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e.response.data)}`)}`)
                        } else {
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e)}`)}`);
                        }
                        try {
                            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: you need to login again; redirecting you to login. Then please try your request again.`)}`);
                            await this.loginAndGetAuthToken(false);
                            return;
                        } catch (e) {
                            if (axios.isAxiosError(e) && e.response) {
                                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e.response.data)}`)}`)
                            } else {
                                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e)}`)}`);
                            }
                            const err = e as any;
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : there was a problem with your request. Please log out and then login and then try your request again`)}`);
                            return err;
                        }
                    }
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`simba: there was a problem with your request. To view debug logs, please set your loglevel to debug and try your request again.`)}`);
                    return error as Error;
                }
                
            }
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
            return new Error(`${this.authErrors.authTokenError}`);
        }
    }

    /**
     * keycloak expects a different contentType (see below)
     * @param url 
     * @param _queryParams 
     * @returns 
     */
    public async doKeycloakGetRequest(
        url: string,
        _queryParams?: Record<any, any>,
    ): Promise<Record<any, any> | Error | void> {
        const funcParams = {
            url,
            _queryParams,
        };
        SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
        const contentType = 'application/x-www-form-urlencoded;charset=utf-8';
        const resData = await this.doGetRequest(url, contentType, _queryParams, false);
        if (resData instanceof Error || axios.isAxiosError(resData)) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(resData)}`)}`);
            return resData;
        }
        SimbaConfig.log.debug(`:: EXIT : result data : ${JSON.stringify(resData)}`);
        return resData;
    }

    /**
     * do post request. uses axios library
     * @param url 
     * @param _postData 
     * @param contentType 
     * @param _buildURL 
     * @returns 
     */
    public async doPostRequest(
        url: string,
        _postData?: Record<any, any>,
        contentType?: string,
        _buildURL: boolean = true,
    ): Promise<Record<any, any> | void> {
        return await this.doPutPostRequest("POST", url, _postData, contentType, _buildURL)
    }

    /**
     * do put request
     * @param url
     * @param _postData
     * @param contentType
     * @param _buildURL
     * @returns
     */
    public async doPutRequest(
        url: string,
        _postData?: Record<any, any>,
        contentType?: string,
        _buildURL: boolean = true,
    ): Promise<Record<any, any> | void> {
        return await this.doPutPostRequest("PUT", url, _postData, contentType, _buildURL)
    }

    /**
     * do put or post request. uses axios library
     * @param method
     * @param url
     * @param _postData
     * @param contentType
     * @param _buildURL
     * @returns
     */
    async doPutPostRequest(
        method: string,
        url: string,
        _postData?: Record<any, any>,
        contentType?: string,
        _buildURL: boolean = true,
    ): Promise<Record<any, any> | void> {
        const funcParams = {
            url,
            _postData,
            contentType,
        };
        SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);

        if (!(method in ['POST', 'PUT'])) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : Invalid method, must be 'POST' or 'PUT'`)}`);
        }

        if (this.tokenExpired()) {
            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: auth token expired`)}`);
            if (this.refreshTokenExpired()) {
                SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refresh token expired, acquiring new auth token`)}`);
                const authToken = await this.loginAndGetAuthToken();
                if (!authToken) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
                    return new Error(`${this.authErrors.authTokenError}`);
                }
            } else {
                SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refreshing token`)}`);
                const newAuthToken = await this.refreshToken();
                if (!newAuthToken) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`)
                    SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: there was an error with your request, please log out and then login again, then try your request again`)}`);
                    return
                }
            }
        }
        const postData = _postData ? _postData : {};
        const headers = await this.accessTokenHeader();
        if (headers) {
            if (!contentType) {
                headers["content-type"] = "application/json";
            } else {
                headers["content-type"] = contentType;
            }
            const config = {
                headers: headers,
            }
            try {
                if (_buildURL) {
                    url = this.buildURL(url);
                }
                let res: AxiosResponse;
                if (method == "POST") {
                    res = await axios.post(url, postData, config);
                } else if (method == "PUT") {
                    res = await axios.put(url, postData, config);
                }
                const resData: Record<any, any> = res!.data;
                SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(resData)}`);
                return resData;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(error.response.data)}`)}`)
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(error)}`)}`);
                }
                SimbaConfig.log.debug(`err: ${JSON.stringify(error)}`);
                if (axios.isAxiosError(error) && error.response && error.response.status === 401)  {
                    SimbaConfig.log.debug(`:: received 401 response, attempting to refresh token`);
                    // if 401 from Simba, then try refreshing token.
                    try {
                        const newAuthToken = await this.refreshToken();
                        if (newAuthToken) {
                            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: new token acquired. Please try your request again`)}`)
                            return;
                        } else {
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: there was a problem acquiring your access token. Please log out and then login and then try your request again`)}`);
                            return;
                        }
                    } catch (e) {
                        if (axios.isAxiosError(e) && e.response) {
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e.response.data)}`)}`)
                        } else {
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e)}`)}`);
                        }
                        try {
                            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: you need to login again; redirecting you to login. Then please try your request again.`)}`);
                            await this.loginAndGetAuthToken(false);
                            return;
                        } catch (e) {
                            if (axios.isAxiosError(e) && e.response) {
                                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e.response.data)}`)}`)
                            } else {
                                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e)}`)}`);
                            }
                            const err = e as any;
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : there was a problem with your request. Please log out and then login and then try your request again`)}`);
                            return err;
                        }
                    }
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`simba: there was a problem with your request. To view debug logs, please set your loglevel to debug and try your request again.`)}`);
                    return error as Error;
                }
            }
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.headersError}`)}`);
            return new Error(`${this.authErrors.headersError}`);
        }
    }

    /**
     * keycloak expects different contentType
     * @param url 
     * @param _postData 
     * @returns 
     */
    public async doKeycloakPostRequest(
        url: string,
        _postData?: Record<any, any>
    ): Promise<Record<any, any> | Error | void> {
        const funcParams = {
            url,
            _postData,
        };
        SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
        const contentType = 'application/x-www-form-urlencoded;charset=utf-8';
        const resData = await this.doPostRequest(url, _postData, contentType, false);
        if (resData instanceof Error) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(resData)}`)}`);
            return resData;
        }
        SimbaConfig.log.debug(`:: EXIT : result data : ${JSON.stringify(resData)}`);
        return resData;
    }
}

export class AzureHandler {
    private readonly closeTimeout: number = 5 * 1000;
    private port = 22315;
    private server: http.Server | null = null;
    private state: string | undefined;
    private redirectURI: string | undefined;
    private pkceVerifier: string | undefined;
    private pkceChallenge: string | undefined;
    private config: Configstore;
    private projectConfig: Configstore;
    private baseURL: string;
    private configBase: string;
    private authErrors: AuthErrors;
    private authInfo: Record<any, any>;
    private baseAuthURL: string;
    private authHtml: Buffer = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'html', 'authResult.html'));
    private clientID: string;
    private tenant: string;
    private policy: string;
    private scope: string;
    private _authorizeUrl: string;
    private tokenURL: string;
    constructor(
        config?: Configstore,
        projectConfig?: Configstore,
    ) {
        this.authErrors = authErrors;
        this.config = SimbaConfig.ConfigStore;
        this.projectConfig = SimbaConfig.ProjectConfigStore;
        this.baseURL = this.projectConfig.get('baseURL') ? this.projectConfig.get('baseURL') : this.projectConfig.get('baseUrl');
        this.baseURL = addSlashToURL(this.baseURL);
        SimbaConfig.ProjectConfigStore.set("baseURL", this.baseURL)
        if (!this.baseURL) {
            SimbaConfig.log.error(`:: ${this.authErrors.noBaseURLError}`);
        }
        this.configBase = this.baseURL.split(".").join("_");
    }

    public async setAndGetAZAuthInfo(): Promise<Record<any, any>> {
        SimbaConfig.log.debug(`:: ENTER :`)
        const authInfo = await SimbaConfig.setAndGetAuthProviderInfo();
        this.clientID = authInfo.client_id;
        this.tenant = authInfo.tenant;
        this.policy = authInfo.policy;
        this.baseAuthURL = authInfo.baseurl;
        this.tokenURL = `${this.baseAuthURL}/${this.policy}/oauth2/v2.0/token`;
        this._authorizeUrl = `${this.baseAuthURL}/${this.policy}/oauth2/v2.0/authorize`
        this.authInfo = authInfo;
        this.scope = `${this.clientID} offline_access`;
        SimbaConfig.log.debug(`:: EXIT :`)
        return authInfo;
    }

    public get authorizeUrl(): string {
        SimbaConfig.log.debug(`:: ENTER :`)
        this.generatePKCE();
        SimbaConfig.log.debug(`:: EXIT :`)
        return `${this._authorizeUrl}?client_id=${this.clientID}&redirect_uri=${this.redirectURI}&response_type=code&state=${this.state}&scope=${this.scope}&code_challenge=${this.pkceChallenge}&code_challenge_method=S256`;
    }

    private deleteAuthInfo(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (this.config.get(this.configBase)) {
            this.config.set(this.configBase, {});
            SimbaConfig.log.debug(`:: EXIT :`);
        }
    }

    public getConfigBase(): string {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (!this.configBase) {
            this.configBase = this.baseURL.split(".").join("_");
        }
        SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(this.configBase)}`);
        return this.configBase;
    }

    public dispose(): void {
        if (this.server) {
            this.server.unref();
            this.server.close();
        }
    }

    public isLoggedIn(): boolean {
        return this.hasConfig(AUTHKEY);
    }

    public async performLogin(
        interactive: boolean = true,
        ): Promise<any> {
        this.state = cryptoRandomString({length: 24, type: 'url-safe'});

        return this.loginAndGetAuthToken(interactive);
    }

    public closeServer(): void {
        setTimeout(() => {
            if (this.server) {
                this.server.close();
            }
        }, this.closeTimeout);
    }

    public async getAndSetAuthTokenFromClientCreds(): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const clientID = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.ID);
        const clientSecret = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.SECRET);
        const authEndpoint = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.AUTHENDPOINT);
        const credential = `${clientID}:${clientSecret}`;
        const utf8EncodedCred = utf8.encode(credential);
        const base64EncodedCred = Buffer.from(utf8EncodedCred).toString('base64');
        const params = new URLSearchParams();
        params.append('grant_type', "client_credentials");
        const headers = {
            "content-type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache",
            "Authorization": `Basic ${base64EncodedCred}`
        };
        const config = {
            headers,
        };
        try {
            const baseURL = handleV2(`${SimbaConfig.ProjectConfigStore.get("baseURL")}`);
            const url = `${baseURL}${authEndpoint}token/`;
            SimbaConfig.log.debug(`:: url : ${url}`);
            const res = await axios.post(url, params, config);
            const access_token = res.data;
            SimbaConfig.log.debug(`:: EXIT : res.data: ${JSON.stringify(res.data)}`);
            this.setConfig(AUTHKEY, this.parseExpiry(access_token));
        } catch (error)  {
            if (axios.isAxiosError(error) && error.response) {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`);
            } else {
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            }
            return;
        }
    }

    public async loginAndGetAuthToken(
        interactive: boolean = true,
        ): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        SimbaConfig.deleteAuthProviderInfo();
        await this.setAndGetAZAuthInfo();
        if (!interactive) {
            this.logout();
            try {
                const authToken = await this.getAndSetAuthTokenFromClientCreds();
                SimbaConfig.log.debug(`:: EXIT : authToken : ${JSON.stringify(authToken)}`);
                return authToken;
            } catch (error)  {
                if (axios.isAxiosError(error) && error.response) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`);
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
                }
                return error as Error;
            }
        }

        return new Promise<void>(async (resolve, reject) => {
            // clear out old auth
            this.logout();

            if (this.server) {
                reject(new Error('Auth already in progress!'));
            }

            this.server = http.createServer();

            this.server.on('close', () => {
                if (this.server) {
                    this.server = null;
                }
                resolve();
            });

            polka({server: this.server})
                .get('/auth-callback/', async (req: Request | any, res: http.ServerResponse) => {
                    const code: string = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
                    const state: string = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
                    const error: string = Array.isArray(req.query.error) ? req.query.error[0] : req.query.error;

                    res.on('finish', () => {
                        this.closeServer();
                    });
                    
                    try {
                        await this.receiveCode(code, state, error);
                        res.writeHead(302, {Location: '/'});
                        res.end();
                    } catch (err) {
                        res.writeHead(302, {Location: `/?error=${Buffer.from(err as any).toString('base64')}`});
                        res.end();
                    }

                })
                .get('/', (_req: Request | any, res: http.ServerResponse) => {
                    res.writeHead(200, {
                        'Content-Length': this.authHtml.length,
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                    res.end(this.authHtml.toString());
                })
                .listen(this.port, (err: Error) => {
                    if (err) {
                        throw err;
                    }

                    this.redirectURI = encodeURIComponent(`http://localhost:${this.port}/auth-callback/`);

                    SimbaConfig.log.info('Please navigate to ' + chalk.underline(this.authorizeUrl) + ' to log in.');
                });
        });
    }

    public async refreshToken(forceRefresh: boolean = false): Promise<any> {
        SimbaConfig.log.debug(":: ENTER :")
        const auth = this.getConfig(AUTHKEY);
        await this.setAndGetAZAuthInfo();
        if (auth) {
            if ("expires_at" in auth) {
                // we use forceRefresh if we've tried a request
                // and got back a 401
                if (forceRefresh) {
                    if (!auth.refresh_token) {
                        // this would mean our AZ token is for client creds
                        const clientID = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.ID);
                        const clientSecret = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.SECRET);
                        const authEndpoint = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.AUTHENDPOINT);
                        if (!clientID || !clientSecret || !authEndpoint) {
                            const message = "refresh_token not present in auth token. To use client credentials, please set SIMBA_AUTH_CLIENT_ID, SIMBA_AUTH_CLIENT_SECRET, and SIMBA_AUTH_CLIENT_ENDPOINT in your environment variables.";
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${message}`)}`);
                            return new Error(message);
                        }
                        await this.getAndSetAuthTokenFromClientCreds();
                        SimbaConfig.log.debug(`:: EXIT :`);
                        return;
                    }
                    const params = new URLSearchParams();
                    params.append('grant_type', 'refresh_token');
                    params.append('client_id', this.clientID);
                    params.append('refresh_token', auth.refresh_token);
                    const headers = {
                        'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
                    };
                    const config = {
                        headers: headers,
                    }
                    const resp = await axios.post(
                        this.tokenURL,
                        params,
                        config,
                    )
                    await this.setConfig(AUTHKEY, this.parseExpiry(resp.data));
                    return;
                }
                const expiresAt = new Date(auth.expires_at);
                if (expiresAt <= new Date()) {
                    if (!auth.refresh_token) {
                        // this would mean our AZ token is for client creds
                        const clientID = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.ID);
                        const clientSecret = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.SECRET);
                        const authEndpoint = await SimbaConfig.retrieveEnvVar(EnvVariableKeys.AUTHENDPOINT);
                        if (!clientID || !clientSecret || !authEndpoint) {
                            const message = "refresh_token not present in auth token. To use client credentials, please set SIMBA_AUTH_CLIENT_ID, SIMBA_AUTH_CLIENT_SECRET, and SIMBA_AUTH_CLIENT_ENDPOINT in your environment variables.";
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${message}`)}`);
                            return new Error(message);
                        }
                        await this.getAndSetAuthTokenFromClientCreds();
                        SimbaConfig.log.debug(`:: EXIT :`);
                        return;
                    }
                    try {
                        const params = new URLSearchParams();
                        params.append('grant_type', 'refresh_token');
                        params.append('client_id', this.clientID);
                        params.append('refresh_token', auth.refresh_token);
                        const headers = {
                            'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
                        };
                        const config = {
                            headers: headers,
                        }
                        const resp = await axios.post(
                            this.tokenURL,
                            params,
                            config,
                        )
                        await this.setConfig(AUTHKEY, this.parseExpiry(resp.data));
                        return;
                    } catch (error)  {
                        if (axios.isAxiosError(error) && error.response) {
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
                        } else {
                            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
                        }
                        return error as Error;
                    }
                } else {
                    SimbaConfig.log.debug(`auth token still valid`);
                    return;
                }
            } else {
                SimbaConfig.log.debug("auth token does not expire");
                return;
            }
        } else {
            SimbaConfig.log.error(`${chalk.redBright("No auth provider info detected. exiting.")}`);
            return new Error("No auth provider info detected. exiting.");
        }
    }

    public parseExpiry(auth: any): any {
        if ('expires_in' in auth) {
            const retrievedAt = new Date();
            const expiresIn = parseInt(auth.expires_in, 10) * 1000;
            const expiresAt = new Date(Date.parse(retrievedAt.toISOString()) + expiresIn);
            auth.retrieved_at = retrievedAt.toISOString();
            auth.expires_at = expiresAt.toISOString();
            if (auth.refresh_expires_in) {
                const refreshExpiresIn = parseInt(auth.expires_in, 10) * 1000;
                const refreshExpiresAt = new Date(Date.parse(retrievedAt.toISOString()) + refreshExpiresIn);
                auth.refresh_expires_at = refreshExpiresAt.toISOString();
            }
        }
        return auth;
    }

    public async receiveCode(code: string, state: string, error: string): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`)
        if (state !== this.state) {
            SimbaConfig.log.error(chalk.redBright('Error logging in to SIMBAChain: state does not match'));
            return new Error('Error logging in to SIMBAChain: state does not match');
        } else if (error) {
            SimbaConfig.log.error(chalk.redBright('Unknown Error logging in to SIMBAChain: ' + error));
            return new Error('Unknown Error logging in to SIMBAChain: ' + error);
        } else if (!code) {
            SimbaConfig.log.error(chalk.redBright('Error logging in to SIMBAChain: missing auth code'));
            return new Error('Error logging in to SIMBAChain: missing auth code');
        } else {
            let uri = '';
            if (this.redirectURI) {
                uri = decodeURIComponent(this.redirectURI);
            }
            SimbaConfig.log.debug(`tokenURL: `, this.tokenURL);

            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('redirect_uri', decodeURIComponent(uri));
            params.append('code_verifier', this.pkceVerifier as string);
            params.append('scope', this.scope);
            params.append('client_id', this.clientID);
            params.append('code', code);
            try {
                const headers = {
                    'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
                };
                const config = {
                    headers: headers,
                }

                const resp = await axios.post(
                    this.tokenURL,
                    params,
                    config,
                );
                SimbaConfig.log.debug(`resp: ${resp}`);
                this.setConfig(AUTHKEY, this.parseExpiry(resp.data));
                SimbaConfig.log.info(chalk.green('Logged In to SIMBA Chain!'));
                return;
            } catch (error)  {
                if (axios.isAxiosError(error) && error.response) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`);
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
                }
                return error as Error;
            }
        }
    }

    public async getClientOptions(url: string, contentType = 'application/json', data?: any): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`)
        await this.refreshToken();
        const auth = this.getConfig(AUTHKEY);
        if (!url.startsWith('http')) {
            url = this.baseURL + url;
        }

        const opts: request.Options = {
            uri: url,
            headers: {
                'Content-Type': contentType,
                Accept: 'application/json',
                Authorization: `${auth.token_type} ${auth.access_token}`,
            },
            json: true,
        };

        if (data) {
            opts.body = data;
        }

        return opts;
    }

    public async doGetRequest(url: string, contentType?: string, _buildURL: boolean = true): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`)
        // the _buildURL param here does not get used. It's strictly been
        // added because the interface call in the truffle and hardhat suites
        // for authStore.doGetRequest expects it.
        return await this.retryAfterTokenRefresh(url, "GET", contentType);
    }

    public async doPostRequest(url: string, data: any, contentType?: string, _buildURL: boolean = true): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`)
        // the _buildURL param here does not get used. It's strictly been
        // added because the interface call in the truffle and hardhat suites
        // for authStore.doPostRequest expects it.
        return await this.retryAfterTokenRefresh(url, "POST", contentType, data);
    }

    public async doPutRequest(url: string, data: any, contentType?: string, _buildURL: boolean = true): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`)
        // the _buildURL param here does not get used. It's strictly been
        // added because the interface call in the truffle and hardhat suites
        // for authStore.doPutRequest expects it.
        return await this.retryAfterTokenRefresh(url, "PUT", contentType, data);
    }

    public logout(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        this.deleteAuthInfo();
        SimbaConfig.deleteAuthProviderInfo();
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    public hasConfig(key: string): boolean {
        SimbaConfig.log.debug(`:: ENTER :`)
        if (!this.config.has(this.configBase)) {
            return false;
        }

        return key in this.config.get(this.configBase);
    }

    public getConfig(key: string): any {
        SimbaConfig.log.debug(`:: ENTER :`)
        if (!this.config.has(this.configBase)) {
            return;
        }

        const dict = this.config.get(this.configBase);

        if (!(key in dict)) {
            return;
        }

        return dict[key];
    }

    protected getOrSetConfig(key: string, value: any): any {
        SimbaConfig.log.debug(`:: ENTER :`)
        if (!this.hasConfig(key)) {
            this.setConfig(key, value);
            return value;
        }

        return this.getConfig(key);
    }

    public setConfig(key: string, value: any): any {
        SimbaConfig.log.debug(`:: ENTER :`)
        if (!this.config.has(this.configBase)) {
            // NOTE(Adam): This should never be the case since it is created in the constructor
            this.config.set(this.configBase, {});
        }
        const dict = this.config.get(this.configBase);
        dict[key] = value;
        this.config.set(this.configBase, dict);

        return value;
    }

    protected deleteConfig(key: string): void {
        SimbaConfig.log.debug(`:: ENTER : key : ${key}`);
        if (!this.config.has(this.baseURL.replace('.', '_'))) {
            SimbaConfig.log.debug(":: EXIT : no configBase detected");
            return;
        }

        const dict = this.config.get(this.configBase);
        SimbaConfig.log.debug(`\nsimba: configBase: ${JSON.stringify(this.configBase)}`)

        if (!(key in dict)) {
            SimbaConfig.log.debug(`:: EXIT : key ${key} not present in config`);
            return;
        }

        delete dict[key];
        SimbaConfig.log.debug(`:: EXIT : new configBase: ${JSON.stringify(dict)}`);
        this.config.set(this.configBase, dict);
    }

    protected generatePKCE(): void {
        SimbaConfig.log.debug(`:: ENTER :`)
        this.pkceVerifier = cryptoRandomString({length: 128, type: 'url-safe'});
        const hash = CryptoJS.SHA256(this.pkceVerifier);
        const b64 = this.base64URL(hash.toString(CryptoJS.enc.Base64));
        this.pkceChallenge = b64;
    }

    private async retryAfterTokenRefresh(
        url: string,
        requestType: string,
        contentType?: string,
        data?: any,
    ): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`)
        await this.setAndGetAZAuthInfo();
        let opts = await this.getClientOptions(url, contentType, data);
        const uri = opts.uri;
        const headers = opts.headers;
        const config = {
            headers,
        };
        SimbaConfig.log.debug(`opts: ${JSON.stringify(opts)}`);
        try {
            if (requestType === "POST") {
                const res = await axios.post(uri, data, config);
                const resData: Record<any, any> = res.data;
                return resData;
            }
            if (requestType === "PUT") {
                const res = await axios.put(uri, data, config);
                const resData: Record<any, any> = res.data;
                return resData;
            }
            if (requestType === "GET") {
                const res = await axios.get(uri, config);
                const resData: Record<any, any> = res.data;
                return resData;
            }
        } catch (error) {
                if (axios.isAxiosError(error) && error.response) {
                    SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`);
                    if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
                        // expired authtoken, so we'll force refresh
                        const forceRefresh: boolean = true;
                        await this.refreshToken(forceRefresh);
                        opts = await this.getClientOptions(url, contentType, data);
                        const headers = opts.headers;
                        const uri = opts.uri;
                        const config = {
                            headers,
                        };
                        if (requestType === "POST") {
                            return await axios.post(uri, data, config);
                        }
                        if (requestType === "GET") {
                            return await axios.get(uri, config);
                        }
                    }
                } else {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
                    return;
                }
                throw error;
        }
    }

    private base64URL(str: string): string {
        return str
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }
}
