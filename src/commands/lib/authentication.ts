import Configstore from "configstore";
import {
    SimbaConfig,
    buildURL,
} from "../lib";
import {default as cryptoRandomString} from 'crypto-random-string';
import * as CryptoJS from 'crypto-js';
import {default as chalk} from 'chalk';
import {Request, default as polka} from 'polka';
import * as request from 'request-promise';
import axios, {AxiosResponse, AxiosError} from "axios";
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
    noBaseURLError: `${chalk.red('simba: Error acquiring SIMBA_API_BASE_URL/baseURL. Please make sure SIMBA_API_BASE_URL is configured')}`,
    noAuthURLError: `${chalk.red('simba: Error acquiring authURL. Please make sure "authURLID" is configured in simba.json')}`,
    noRealmError: `${chalk.red('simba: Error acquiring realm. Please make sure "realm" is configured in simba.json')}`,
    badAuthProviderInfo: `${chalk.red('simba: Error acquiring auth provider info. This may be due to a bad SIMBA_API_BASE_URL/baseURL value. Please make sure SIMBA_API_BASE_URL is configured')}`,
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

/**
 * This class handles our login for keycloak device login
 */
export class KeycloakHandler {
    private config: Configstore;
    private projectConfig: Configstore;
    public baseURL: string;
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
        this.baseURL = SimbaConfig.retrieveBaseAPIURL();
        if (!this.baseURL) {
            SimbaConfig.log.error(`:: ${this.authErrors.noBaseURLError}`);
        }
        this.configBase = this.baseURL.split(".").join("_");
    }

    /**
     * handles login
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
     * this method does not necessarily serve a big purpose right now,
     * may want to remove in future
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
     * deletes our auth info / auth token in authconfig.json
     */
    public async logout(): Promise<void> {
        SimbaConfig.log.debug(`:: ENTER :`);
        this.setLoggedInStatus(false);
        this.deleteAuthInfo();
        SimbaConfig.deleteAuthProviderInfo();
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    /**
     * deletes auth info in authconfig.json
     */
    protected deleteAuthInfo(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (this.config.get(this.configBase)) {
            this.config.set(this.configBase, {});
            SimbaConfig.log.debug(`:: EXIT :`);
        }
    }

    /**
     * tells us whether a certain key exists in our configstore (authconfig.json)
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
     * return value for key from configstore (authconfig.json)
     * @param key 
     * @returns 
     */
    public getConfig(key: string): any {
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
     * pertains to configstore (authconfig.json)
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
     * sets key/value in configstore (authconfig.json)
     * @param key 
     * @param value 
     * @returns 
     */
    public setConfig(key: string, value: any): any {
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
     * deletes keyu, value in configstore (authconfig.json)
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

    /**
     * uses expires_in from authtoken to create more human readable version,
     * as well as expires_at
     * @param auth 
     * @returns 
     */
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

    /**
     * retrieves auth token using client creds, sets authtoken in authconfig.json
     * @returns 
     */
    public async getAndSetAuthTokenFromClientCreds(): Promise<any> {
        SimbaConfig.log.debug(`:: ENTER :`);
        const clientID = SimbaConfig.retrieveEnvVar(EnvVariableKeys.ID);
        const clientSecret = SimbaConfig.retrieveEnvVar(EnvVariableKeys.SECRET);
        const authEndpoint = SimbaConfig.retrieveEnvVar(EnvVariableKeys.AUTHENDPOINT);
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
            const baseURL = SimbaConfig.retrieveBaseAPIURL();
            const url = buildURL(baseURL, `${authEndpoint}token/`);
            SimbaConfig.log.debug(`:: url : ${url}`);
            const res = await axios.post(url, params, config);
            let authToken = res.data;
            authToken = this.parseExpiry(authToken);
            this.setConfig(AUTHKEY, authToken);
            SimbaConfig.log.debug(`:: EXIT : authToken: ${JSON.stringify(authToken)}`);
            return authToken;
        } catch (error)  {
            if (axios.isAxiosError(error) && error.response) {
                if (error.response.data.error === "invalid_client") {
                    const message = "'invalid_client' error. This may mean you are using an invalid client ID and secret. Please make sure that your values for SIMBA_AUTH_CLIENT_ID and SIMBA_AUTH_CLIENT_SECRET are correct, were generated for the correct environment, and are properly set in .simbachain.env, simbachain.env, or .env. You create one of these files and set in either your project root or SIMBA_HOME location.";
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
                    throw new Error(message);
                }
                const message = JSON.stringify(error.response.data);
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
                throw new Error(message);
            } else {
                const message = JSON.stringify(error);
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
                throw new Error(message);
            }
        }
    }

    /**
     * first step in logging in. returns verification info, including a URI,
     * to allow user to login.
     * @returns 
     */
    private async getVerificationInfo(): Promise<KeycloakDeviceVerificationInfo> {
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
                const message = JSON.stringify(error.response.data);
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
                throw new Error(message);
            } else {
                const message = JSON.stringify(error);
                SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
                throw new Error(message);
            }
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
        if (new Date(authToken.expires_at) <= new Date()) {
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
        if (new Date(authToken.refresh_expires_at) <= new Date()) {
            SimbaConfig.log.debug(`:: EXIT : refresh_token expired, returning true`);
            return true;
        }
        SimbaConfig.log.debug(`:: EXIT : false`);
        return false;
    }

    /**
     * refresh auth token using refresh token
     * @returns {Promise<KeycloakAccessToken | ClientCredsToken | void>}
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
     * used for both client creds and device login
     * @param refreshing specifies whether just refreshing
     * @param interactive device login if true, client creds if false
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
     * @returns {Promise<Record<any, any> | void>}
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
     * creates full url given our baseURL and an endpoint, while handling redundant "/"
     * @param urlExtension 
     * @returns {string}
     */
    public buildURL(
        endpoint: string,
    ): string {
        SimbaConfig.log.debug(`:: ENTER : ${endpoint}`);
        if (endpoint.startsWith("http")) {
            SimbaConfig.log.debug(`:: EXIT : ${endpoint}`);
            return endpoint;
        }
        let baseURL = this.baseURL.endsWith("/") ? this.baseURL : this.baseURL + "/";
        let modifiedExtension = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
        const fullURL = baseURL + modifiedExtension;
        SimbaConfig.log.debug(`:: EXIT : ${fullURL}`);
        return fullURL;
    }

    /**
     * make get request. currently uses Axios
     * @param url 
     * @param contentType 
     * @param _queryParams 
     * @param _buildURL - builds url using baseURL and url if true
     * @returns {Promise<Record<any, any> | Error | void>}
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
                    throw new Error(`${this.authErrors.authTokenError}`);
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
                    url = buildURL(this.baseURL, url);
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
                SimbaConfig.log.debug(`simba: ${chalk.redBright(`${JSON.stringify(error)}`)}`);
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
                    const message = `simba: there was a problem with your request. To view debug logs, please set your loglevel to debug and try your request again.`;
                    SimbaConfig.log.error(`${chalk.redBright(`${message}`)}`);
                    throw new Error(message);
                }
                
            }
        } else {
            const message = `${this.authErrors.authTokenError}`;
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
            throw new Error(message);
        }
    }

    /**
     * do post request. uses axios library
     * @param url 
     * @param _postData 
     * @param contentType 
     * @param _buildURL - builds url using baseURL and url if true
     * @returns {Promise<Record<any, any> | void>}
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
     * @param _buildURL - builds url using baseURL and url if true
     * @returns {Promise<Record<any, any> | void>}
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
     * @param _buildURL - builds url using baseURL and url if true
     * @returns {Promise<Record<any, any> | void>}
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

        if (!(['POST', 'PUT'].includes(method))) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : Invalid method, must be 'POST' or 'PUT'`)}`);
        }

        if (this.tokenExpired()) {
            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: auth token expired`)}`);
            if (this.refreshTokenExpired()) {
                SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refresh token expired, acquiring new auth token`)}`);
                const authToken = await this.loginAndGetAuthToken();
                if (!authToken) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
                    throw new Error(`${this.authErrors.authTokenError}`);
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
                    url = buildURL(this.baseURL, url);
                }
                let res: AxiosResponse;
                if (method === "POST") {
                    res = await axios.post(url, postData, config);
                } else if (method === "PUT") {
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
                SimbaConfig.log.debug(`simba: ${JSON.stringify(error)}`);
                if (
                    axios.isAxiosError(error) &&
                    error.response &&
                    error.response.data &&
                    error.response.data.errors &&
                    error.response.data.errors[0].detail &&
                    error.response.data.errors[0].detail.includes("unsupported version")) 
                    {
                        const detail = error.response.data.errors[0].detail;
                        const version = detail.split("version")[1];
                        const message = `\nsimba: you are attempting to export a contract that uses solc compiler version ${version}, which is not supported. Please switch your solc compiler to a supported version. This likely includes updating your compiler version in the contract source code, as well as configuring the compiler that your project is using. Please navigate to the following URL for supported versions of Solidity: https://simba-chain.gitbook.io/documentation/faq/faq#supported-versions\n`;
                        SimbaConfig.log.error(`${chalk.redBright(`${message}`)}`);
                        throw new Error(message);
                    }
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
                    const message = `simba: there was a problem with your request. To view debug logs, please set your loglevel to debug and try your request again.`;
                    SimbaConfig.log.error(`${chalk.redBright(`${message}`)}`);
                    throw new Error(message)
                }
            }
        } else {
            const message = `${this.authErrors.headersError}`;
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
            throw new Error(message);
        }
    }

    /**
     * 
     * @param url 
     * @param contentType 
     * @param _buildURL - builds url using baseURL and url if true
     * @returns {Promise<Record<any, any> | void>}
     */
    async doDeleteRequest(
        url: string,
        contentType?: string,
        _buildURL: boolean = true,
    ): Promise<Record<any, any> | void> {
        const entryParams = {
            url,
            contentType,
            _buildURL,
        };
        SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);

        if (this.tokenExpired()) {
            SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: auth token expired`)}`);
            if (this.refreshTokenExpired()) {
                SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refresh token expired, acquiring new auth token`)}`);
                const authToken = await this.loginAndGetAuthToken();
                if (!authToken) {
                    SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
                    throw new Error(`${this.authErrors.authTokenError}`);
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
                    url = buildURL(this.baseURL, url);
                }
                let res: AxiosResponse;
                res = await axios.delete(url, config);
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
                    const message = `simba: there was a problem with your request. To view debug logs, please set your loglevel to debug and try your request again.`;
                    SimbaConfig.log.error(`${chalk.redBright(`${message}`)}`);
                    throw new Error(message);
                }
            }
        } else {
            const message = `${this.authErrors.headersError}`;
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
            throw new Error(`${message}`);
        }
    }
}
