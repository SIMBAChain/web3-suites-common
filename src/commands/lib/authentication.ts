import Configstore from "configstore";
import {
    SimbaConfig,
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
    AxiosError
} from "axios";
import {
    URLSearchParams,
} from "url";

export const AUTHKEY = 'SIMBAAUTH';

const authHtml = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'html', 'authResult.html'));

interface PollingConfig {
    maxAttempts: number;
    interval: number;
}

enum AuthProviders {
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
}

const SIMBAERROR = "SIMBAERROR";

const KeycloakAuthErrors: AuthErrors = {
    headersError: `${chalk.red('simba: Error acquiring auth headers. Please make sure keycloak certs are not expired.')}`,
    keycloakCertsError: `${chalk.red('simba: Error obtaining creds from keycloak. Please make sure keycloak certs are not expired.')}`,
    verificationInfoError: `${chalk.red('simba: Error acquiring verification info. Please make sure keycloak certs are not expired.')}`,
    authTokenError: `${chalk.red('simba: Error acquiring auth token. Please make sure keycloak certs are not expired')}`,
    noClientIDError: `${chalk.red('simba: Error acquiring clientID. Please make sure "clientID" is configured in simba.json')}`,
    noBaseURLError: `${chalk.red('simba: Error acquiring baseURL. Please make sure "baseURL" is configured in simba.json')}`,
    noAuthURLError: `${chalk.red('simba: Error acquiring authURL. Please make sure "authURLID" is configured in simba.json')}`,
    noRealmError: `${chalk.red('simba: Error acquiring realm. Please make sure "realm" is configured in simba.json')}`,
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

function handleV2(baseURL: string): string {
    if (baseURL.endsWith("/v2/") || baseURL.endsWith("/v2")) {
        const extension = baseURL.endsWith("/v2") ? "/v2" : "/v2/";
        const shortenedBaseURL = baseURL.slice(0,-(extension.length));
        return shortenedBaseURL;
    }
    return baseURL;
}

/**
 * This class handles our login for keycloak device login
 * In the future, when we decide to introduce other auth flows,
 * then we should have a similar class for other auth flows
 */
class KeycloakHandler {
    private config: Configstore;
    private projectConfig: Configstore;
    private baseURL: string;
    private verificationInfo: KeycloakDeviceVerificationInfo;
    private tokenExpirationPad: number;
    private configBase: string;
    private authErrors: AuthErrors;
    private _loggedIn: boolean;
    constructor(
        config?: Configstore,
        projectConfig?: Configstore,
        tokenExpirationPad: number = 60,
    ) {
        this.authErrors = KeycloakAuthErrors;
        this.config = SimbaConfig.ConfigStore;
        this.projectConfig = SimbaConfig.ProjectConfigStore;
        this.baseURL = this.projectConfig.get('baseURL') ? this.projectConfig.get('baseURL') : this.projectConfig.get('baseUrl');
        if (!this.baseURL) {
            SimbaConfig.log.error(`:: ${this.authErrors.noBaseURLError}`);
        }
        this.configBase = this.baseURL.split(".").join("_");
        this.tokenExpirationPad = tokenExpirationPad;
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
        SimbaConfig.log.debug(`:: EXIT :`);
    }

    /**
     * deletes auth info
     */
    protected deleteAuthInfo(): void {
        SimbaConfig.log.debug(`:: ENTER :`);
        this.config.set(this.configBase, {});
        SimbaConfig.log.debug(`:: EXIT :`);
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
                    const authToken: KeycloakAccessToken = response.data
                    authToken.expires_at = Math.floor(Date.now() / 1000) + authToken.expires_in;
                    authToken.refresh_expires_at = Math.floor(Date.now() / 1000) + authToken.refresh_expires_in;
                    this.setConfig("authToken", authToken);
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
            const authToken = this.getConfig("authToken");
            SimbaConfig.log.debug(`:: auth : ${JSON.stringify(authToken)}`);
            const _refreshToken = authToken.refresh_token;
            params.append("client_id", clientID);
            params.append("grant_type", "refresh_token");
            params.append("refresh_token", _refreshToken);
            await new Promise(resolve => setTimeout(resolve, interval));
            try {
                let response = await axios.post(url, params, config);
                const newAuthToken: KeycloakAccessToken = response.data;
                newAuthToken.expires_at = Math.floor(Date.now() / 1000) + newAuthToken.expires_in;
                newAuthToken.refresh_expires_at = Math.floor(Date.now() / 1000) + newAuthToken.refresh_expires_in;
                this.setConfig("authToken", newAuthToken);
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
        if (!this.hasConfig("authToken")) {
            SimbaConfig.log.debug(`:: EXIT : no authToken exists, exiting with true`);
            return true;
        }
        const authToken = this.getConfig("authToken");
        if (!authToken.expires_at) {
            SimbaConfig.log.debug(`:: EXIT : true`);
            return true;
        }
        // return true below, to pad for time required for operations
        if (authToken.expires_at < Math.floor(Date.now()/1000) - this.tokenExpirationPad) {
            SimbaConfig.log.debug(`:: EXIT : access_token expiring within ${this.tokenExpirationPad} seconds, returning true`);
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
        if (!this.hasConfig("authToken")) {
            SimbaConfig.log.debug(`:: EXIT : true`);
            return true;
        }
        const authToken = this.getConfig("authToken");
        if (!authToken.refresh_expires_at) {
            SimbaConfig.log.debug(`:: EXIT : true`);
            return true;
        }
        // return true below, to pad for time required for operations
        if (authToken.refresh_expires_at <= Math.floor(Date.now()/1000) - this.tokenExpirationPad) {
            SimbaConfig.log.debug(`:: EXIT : access_token expiring within ${this.tokenExpirationPad} seconds, returning true`);
            return true;
        }
        SimbaConfig.log.debug(`:: EXIT : false`);
        return false;
    }

    /**
     * refresh auth token using refresh token
     * @returns 
     */
    public async refreshToken(): Promise<KeycloakAccessToken | void> {
        SimbaConfig.log.debug(`:: ENTER :`);
        if (this.refreshTokenExpired()) {
            this.deleteAuthInfo();
            const authToken = await this.loginAndGetAuthToken();
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
    ): Promise<KeycloakAccessToken | void> {
        SimbaConfig.log.debug(`:: ENTER :`);
        let verificationCompleteURI;
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
        let authToken = this.getConfig("authToken");
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
        const funcParams = {
            url,
            _postData,
            contentType,
        };
        SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
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
                const res = await axios.post(url, postData, config);
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

// /**
//  * This class handles azure b2c configured environments
//  * azure b2c does not allow device login, so we're using login server
//  */
//  class AzureHandler {
//     private readonly closeTimeout: number = 5 * 1000;
//     private port = 22315;
//     private scope: string;
//     private server: http.Server | null = null;
//     private state: string | undefined;
//     private redirectURI: string | undefined;
//     private tokenURL: string;
//     private pkceVerifier: string | undefined;
//     private pkceChallenge: string | undefined;
//     private _authorizeURL: string;
//     private config: Configstore;
//     private projectConfig: Configstore;
//     private clientID: string;
//     private authURL: string;
//     private baseURL: string;
//     private verificationInfo: KeycloakDeviceVerificationInfo;
//     private tokenExpirationPad: number;
//     private configBase: string;
//     private authErrors: AuthErrors;
//     private tenant: string;
//     private _loggedIn: boolean;
//     // PROBABLY NOT HARDCODING FOLLOWING LINES IN PRODUCTION:
//     private policy: string = "b2c_1_signin_signup";
//     private scopes = "openid";
//     private _authorizeUrl: string = `https://`
//     private authScope: string = `api://simba-dev-blocks/access ${this.scopes}`

//     constructor(
//         config?: Configstore,
//         projectConfig?: Configstore,
//         tokenExpirationPad: number = 60,
//     ) {
//         this.authErrors = KeycloakAuthErrors;
//         this.config = SimbaConfig.ConfigStore;
//         this.projectConfig = SimbaConfig.ProjectConfigStore;
//         this.baseURL = this.projectConfig.get('baseURL') ? this.projectConfig.get('baseURL') : this.projectConfig.get('baseUrl');
//         if (!this.baseURL) {
//             SimbaConfig.log.error(`:: ${this.authErrors.noBaseURLError}`);
//         }
//         this.configBase = this.baseURL.split(".").join("_");
//         this.tokenExpirationPad = tokenExpirationPad;
//         this.scope = encodeURI(this.authScope)
//     }

    

//     // public get isLoggedIn(): boolean {
//     //     return this.hasConfig(AUTHKEY);
//     // }

//     public get authorizeUrl(): string {
//         this.generatePKCE();
//         return `${this._authorizeUrl}?client_id=${this.clientID}&redirect_uri=${this.redirectURI}&response_type=code&state=${this.state}&scope=${this.scope}&code_challenge=${this.pkceChallenge}&code_challenge_method=S256`;
//     }

//     protected generatePKCE(): void {
//         this.pkceVerifier = cryptoRandomString({length: 24, type: 'url-safe'});
//         const hash = CryptoJS.SHA256(this.pkceVerifier);
//         const b64 = this.base64URL(hash.toString(CryptoJS.enc.Base64));
//         this.pkceChallenge = b64;
//     }

//     /**
//      * used as field for our auth token
//      * @returns 
//      */
//     protected getConfigBase(): string {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         if (!this.configBase) {
//             this.configBase = this.baseURL.split(".").join("_");
//         }
//         SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(this.configBase)}`);
//         return this.configBase;
//     }

//     /**
//      * self explanatory
//      * @param status 
//      */
//     public setLoggedInStatus(status: boolean): void {
//         SimbaConfig.log.debug(`:: ENTER : ${status}`);
//         this._loggedIn = status;
//         SimbaConfig.log.debug(`:: EXIT :`);
//     }

//     /**
//      * used to avoid trying to login in when the process has already begun
//      * @returns 
//      */
//     public isLoggedIn(): boolean {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         if (this.verificationInfo) {
//             SimbaConfig.log.debug(`:: EXIT : ${true}`);
//             return true;
//         } else {
//             SimbaConfig.log.debug(`:: EXIT : ${false}`);
//             return false;
//         }
//     }

//     /**
//      * deletes our auth info
//      */
//     public async logout(): Promise<void> {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         this.setLoggedInStatus(false);
//         this.deleteAuthInfo();
//         SimbaConfig.log.debug(`:: EXIT :`);
//     }

//     /**
//      * deletes auth info
//      */
//     protected deleteAuthInfo(): void {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         this.config.set(this.configBase, {});
//         SimbaConfig.log.debug(`:: EXIT :`);
//     }

//     /**
//      * not currently used
//      * @returns 
//      */
//     protected getPathToConfigFile(): string {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         SimbaConfig.log.debug(`:: EXIT :`);
//         return this.config.path;
//     }

//     /**
//      * tells us whether a certian key exists in our configstore
//      * @param key 
//      * @returns 
//      */
//     protected hasConfig(key: string): boolean {
//         SimbaConfig.log.debug(`:: ENTER : ${key}`);
//         if (!this.config.has(this.configBase)) {
//             SimbaConfig.log.debug(`:: EXIT : ${false}`);
//             return false;
//         }
//         const _hasConfig = key in this.config.get(this.getConfigBase());
//         SimbaConfig.log.debug(`:: EXIT : ${_hasConfig}`);
//         return _hasConfig;
//     }

//     /**
//      * return config from configstore
//      * @param key 
//      * @returns 
//      */
//     protected getConfig(key: string): any {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         if (!this.config.has(this.configBase)) {
//             SimbaConfig.log.debug(`:: EXIT :`);
//             return;
//         }
//         const dict = this.config.get(this.getConfigBase());
//         if (!(key in dict)) {
//             SimbaConfig.log.debug(`:: EXIT :`);
//             return;
//         }
//         const _config = dict[key];
//         SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(_config)}`);
//         return _config;
//     }

//     /**
//      * pertains to configstore
//      * @param key 
//      * @param value 
//      * @returns 
//      */
//     protected getOrSetConfig(key: string, value: any): any {
//         const entryParams = {
//             key,
//             value,
//         }
//         SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);
//         if (!this.hasConfig(key)) {
//             this.setConfig(key, value);
//             SimbaConfig.log.debug(`:: EXIT :`);
//             return value;
//         }
//         SimbaConfig.log.debug(`:: EXIT :`);
//         return this.getConfig(key);
//     }

//     /**
//      * sets config in configstore
//      * @param key 
//      * @param value 
//      * @returns 
//      */
//     protected setConfig(key: string, value: any): any {
//         SimbaConfig.log.debug(`:: ENTER : KEY: ${key}, VALUE: ${JSON.stringify(value)}`);
//         if (!this.config.has(this.configBase)) {
//             this.config.set(this.configBase, {});
//         }
//         const dict = this.config.get(this.configBase);
//         dict[key] = value;
//         this.config.set(this.configBase, dict);
//         SimbaConfig.log.debug(`configBase : ${JSON.stringify(this.configBase)}`);
//         SimbaConfig.log.debug(`:: EXIT :`);
//         return value;
//     }

//     /**
//      * deletes config in configstore
//      * @param key 
//      * @returns 
//      */
//     protected deleteConfig(key: string): void {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         if (!this.config.has(this.configBase)) {
//             SimbaConfig.log.debug(`:: EXIT :`);
//             return;
//         }
//         const dict = this.config.get(this.configBase);
//         if (!(key in dict)) {
//             SimbaConfig.log.debug(`:: EXIT :`);
//             return;
//         }
//         delete dict[key];
//         this.config.set(this.configBase, dict);
//         SimbaConfig.log.debug(`:: EXIT :`);
//     }

//     /**
//      * first step in logging in. returns verification info, including a URI,
//      * to allow user to login.
//      * @returns 
//      */
//     private async getVerificationInfo(): Promise<KeycloakDeviceVerificationInfo | Error> {
//         // need to go grab our authURL first

//         // based on authURL, our flow will be different. The following lines follow keycloak flow
//         // so this.authURL etc. should be changed to 
//         SimbaConfig.log.debug(`:: ENTER :`);
//         const authProviderInfo = await SimbaConfig.setAndGetAuthProviderInfo();
//         const tenant = authProviderInfo.tenant;
//         const authURL = authProviderInfo.baseurl;
//         const clientID = authProviderInfo.client_id;
//         const url = `${authURL}/realms/${this.realm}/protocol/openid-connect/auth/device`;
//         const params = new URLSearchParams();
//         params.append('client_id', this.clientID);
//         const headers = {
//             'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
//         };
//         const config = {
//             headers: headers,
//         }
//         try {
//             const res = await axios.post(url, params, config);
//             const verificationInfo: KeycloakDeviceVerificationInfo = res.data;
//             this.verificationInfo = verificationInfo;
//             SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(this.verificationInfo)}`);
//             return verificationInfo;
//         } catch (error) {
//             if (axios.isAxiosError(error) && error.response) {
//                 SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
//             } else {
//                 SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
//             }
//             return error as Error;
//         }
//     }

//     /**
//      * reads out URI user should navigate to for login
//      * @returns 
//      */
//     public async loginUser(): Promise<void | string> {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         if (!this.isLoggedIn()) {
//             this.verificationInfo = await this.getVerificationInfo() as KeycloakDeviceVerificationInfo;
//         }
//         const verificationCompleteURI = this.verificationInfo.verification_uri_complete;
//         // the following line is where we begin the flow of handling not acquiring verification info
//         if (!verificationCompleteURI) {
//             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.keycloakCertsError}`)}`);
//             return SIMBAERROR;
//         }
//         SimbaConfig.log.info(`\n${chalk.cyanBright('\nsimba: Please navigate to the following URI to log in: ')} ${chalk.greenBright(verificationCompleteURI)}`);
//         SimbaConfig.log.debug(`:: EXIT :`);
//         return verificationCompleteURI;
//     }

//     /**
//      * allows user to login after they have navigated to the URI from loginUser()
//      * @param pollingConfig 
//      * @param refreshing 
//      * @returns 
//      */
//     public async getAuthToken(
//         pollingConfig: PollingConfig = {
//             maxAttempts: 60,
//             interval: 3000,
//         },
//         refreshing: boolean = false,
//     ): Promise<KeycloakAccessToken | void> {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         const maxAttempts = pollingConfig.maxAttempts;
//         const interval = pollingConfig.interval;
//         if (!this.isLoggedIn()) {
//             this.verificationInfo = await this.getVerificationInfo() as KeycloakDeviceVerificationInfo;
//         }
//         if (!this.verificationInfo) {
//             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.verificationInfoError}`)}`);
//             return;
//         }
//         const deviceCode = this.verificationInfo.device_code;
//         const params = new URLSearchParams();
//         const authProviderInfo = await SimbaConfig.setAndGetAuthProviderInfo();
//         const realm = authProviderInfo.realm;
//         const authURL = authProviderInfo.baseurl;
//         const clientID = authProviderInfo.client_id;
//         const url = `${authURL}/realms/${this.realm}/protocol/openid-connect/token`;
//         const headers = {
//             'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
//         };
//         const config = {
//             headers: headers,
//         }
//         if (!refreshing) {
//             params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
//             params.append("client_id", this.clientID);
//             params.append("device_code", deviceCode);
//             let attempts = 0;
//             while (attempts < maxAttempts) {
//                 await new Promise(resolve => setTimeout(resolve, interval));
//                 try {
//                     let response = await axios.post(url, params, config);
//                     const authToken: KeycloakAccessToken = response.data
//                     authToken.expires_at = Math.floor(Date.now() / 1000) + authToken.expires_in;
//                     authToken.refresh_expires_at = Math.floor(Date.now() / 1000) + authToken.refresh_expires_in;
//                     this.setConfig("authToken", authToken);
//                     SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(authToken)}`);
//                     return authToken;
//                 } catch (error) {
//                     if (attempts%5 == 0) {
//                         SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: still waiting for user to login...`)}`);
//                     }
//                     attempts += 1;
//                 }
//             }
//             SimbaConfig.log.debug(`:: EXIT : attempts exceeded, timedout`);
//             return
//         } else {
//             SimbaConfig.log.debug(`:: entering refresh logic`);
//             const authToken = this.getConfig("authToken");
//             SimbaConfig.log.debug(`:: auth : ${JSON.stringify(authToken)}`);
//             const _refreshToken = authToken.refresh_token;
//             params.append("client_id", this.clientID);
//             params.append("grant_type", "refresh_token");
//             params.append("refresh_token", _refreshToken);
//             await new Promise(resolve => setTimeout(resolve, interval));
//             try {
//                 let response = await axios.post(url, params, config);
//                 const newAuthToken: KeycloakAccessToken = response.data;
//                 newAuthToken.expires_at = Math.floor(Date.now() / 1000) + newAuthToken.expires_in;
//                 newAuthToken.refresh_expires_at = Math.floor(Date.now() / 1000) + newAuthToken.refresh_expires_in;
//                 this.setConfig("authToken", newAuthToken);
//                 SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(newAuthToken)}`);
//                 return newAuthToken;
//             } catch (error) {
//                 if (axios.isAxiosError(error) && error.response) {
//                     SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
//                 } else {
//                     SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
//                 }
//                 return;
//             }
//         }
//     }

//     /**
//      * checks if auth token is expired. used as a check before we make http call
//      * idea is to check for bad token before http call, if possible
//      * @returns 
//      */
//     public tokenExpired(): boolean {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         if (!this.hasConfig("authToken")) {
//             SimbaConfig.log.debug(`:: EXIT : no authToken exists, exiting with true`);
//             return true;
//         }
//         const authToken = this.getConfig("authToken");
//         if (!authToken.expires_at) {
//             SimbaConfig.log.debug(`:: EXIT : true`);
//             return true;
//         }
//         // return true below, to pad for time required for operations
//         if (authToken.expires_at < Math.floor(Date.now()/1000) - this.tokenExpirationPad) {
//             SimbaConfig.log.debug(`:: EXIT : access_token expiring within ${this.tokenExpirationPad} seconds, returning true`);
//             return true;
//         }
//         SimbaConfig.log.debug(`:: EXIT : false`);
//         return false;
//     }

//     /**
//      * checks if refresh token is expired. used as a check before we make http call
//      * idea is to check for bad token before http call, if possible
//      * @returns 
//      */
//     public refreshTokenExpired(): boolean {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         if (!this.hasConfig("authToken")) {
//             SimbaConfig.log.debug(`:: EXIT : true`);
//             return true;
//         }
//         const authToken = this.getConfig("authToken");
//         if (!authToken.refresh_expires_at) {
//             SimbaConfig.log.debug(`:: EXIT : true`);
//             return true;
//         }
//         // return true below, to pad for time required for operations
//         if (authToken.refresh_expires_at <= Math.floor(Date.now()/1000) - this.tokenExpirationPad) {
//             SimbaConfig.log.debug(`:: EXIT : access_token expiring within ${this.tokenExpirationPad} seconds, returning true`);
//             return true;
//         }
//         SimbaConfig.log.debug(`:: EXIT : false`);
//         return false;
//     }

//     /**
//      * refresh auth token using refresh token
//      * @returns 
//      */
//     public async refreshToken(): Promise<KeycloakAccessToken | void> {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         if (this.refreshTokenExpired()) {
//             this.deleteAuthInfo();
//             const authToken = await this.loginAndGetAuthToken();
//             if (authToken) {
//                 SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(authToken)}`);
//                 return authToken;
//             } else {
//                 SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
//                 return;
//             }
//         }
//         SimbaConfig.log.debug(`:: entering logic to refresh token`);
//         const pollingConfig: PollingConfig = {
//             maxAttempts: 60,
//             interval: 3000,
//         };
//         const refreshing = true;
//         const newAuthToken = await this.getAuthToken(
//             pollingConfig,
//             refreshing,
//         );
//         if (newAuthToken) {
//             SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(newAuthToken)}`);
//             return newAuthToken;
//         } else {
//             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
//             return;
//         }
//     }

//     /**
//      * self explanatory
//      * @param refreshing 
//      * @returns 
//      */
//     public async loginAndGetAuthToken(
//         refreshing: boolean = false,
//     ): Promise<KeycloakAccessToken | void> {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         let verificationCompleteURI;
//         if (!refreshing) {
//             this.logout();
//             verificationCompleteURI = await this.loginUser();
//         }
//         // below we are checking to make sure that SIMBERROR was not returned from loginuser
//         if (verificationCompleteURI !== SIMBAERROR) {
//             const pollingConfig: PollingConfig = {
//                 maxAttempts: 60,
//                 interval: 3000,
//             };
//             const authToken = await this.getAuthToken(pollingConfig, refreshing) as KeycloakAccessToken;
//             SimbaConfig.log.debug(`:: EXIT : authToken : ${JSON.stringify(authToken)}`);
//             this.setLoggedInStatus(true);
//             return authToken;
//         } else {
//             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: :: EXIT : ${this.authErrors.verificationInfoError}`)}`);
//             return;
//         }
//     }

//     /**
//      * returns headers with access token
//      * @returns 
//      */
//     public async accessTokenHeader(): Promise<Record<any, any> | void> {
//         SimbaConfig.log.debug(`:: ENTER :`);
//         let authToken = this.getConfig("authToken");
//         if (!authToken) {
//             authToken = await this.loginAndGetAuthToken(false);
//         }
//         if (authToken) {
//             const accessToken = authToken.access_token;
//             const headers = {
//                 Authorization: `Bearer ${accessToken}`,
//             };
//             SimbaConfig.log.debug(`:: EXIT : headers: ${JSON.stringify(headers)}`);
//             return headers;
//         } else {
//             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
//             return;
//         }
//     }

//     /**
//      * combines URL paths while checking for "v2" at end of first path, since this is a common mistake (double v2s)
//      * @param urlExtension 
//      * @returns 
//      */
//     public buildURL(
//         urlExtension: string,
//     ): string {
//         SimbaConfig.log.debug(`:: ENTER : ${urlExtension}`);
//         if (urlExtension.startsWith("http")) {
//             SimbaConfig.log.debug(`:: EXIT : ${urlExtension}`);
//             return urlExtension;
//         }
//         let baseURL = this.baseURL.endsWith("/") ? this.baseURL : this.baseURL + "/";
//         baseURL = baseURL.endsWith("v2/") ? baseURL : baseURL.slice(0, -1) + "v2/";
//         const fullURL = baseURL + urlExtension;
//         SimbaConfig.log.debug(`:: EXIT : ${fullURL}`);
//         return fullURL;
//     }

//     /**
//      * make get request. uses axios library
//      * @param url 
//      * @param contentType 
//      * @param _queryParams 
//      * @param _buildURL 
//      * @returns 
//      */
//     public async doGetRequest(
//         url: string,
//         contentType?: string,
//         _queryParams?: Record<any, any>,
//         _buildURL: boolean = true,
//     ): Promise<Record<any, any> | Error | void> {
//         const funcParams = {
//             url,
//             _queryParams,
//             contentType,
//         }
//         SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
//         if (this.tokenExpired()) {
//             SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: auth token expired`)}`)
//             if (this.refreshTokenExpired()) {
//                 SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refresh token expired, acquiring new auth token`)}`);
//                 const authToken = await this.loginAndGetAuthToken();
//                 if (!authToken) {
//                     SimbaConfig.log.error(`${chalk.red(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
//                     return new Error(`${this.authErrors.authTokenError}`);
//                 }
//             } else {
//                 SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refreshing token`)}`);
//                 const newAuthToken = await this.refreshToken();
//                 if (!newAuthToken) {
//                     SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`)
//                     SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: there was an error with your request, please log out and then login again, then try your request again`)}`);
//                     return
//                 }
//             }
//         }
//         const queryParams = _queryParams ? _queryParams : {};
//         const headers = await this.accessTokenHeader();
//         if (headers) {
//             if (!contentType) {
//                 headers["content-type"] = "application/json";
//             } else {
//                 headers["content-type"] = contentType;
//             }
//             const params = new URLSearchParams();
//             params.append('client_id', this.clientID);
//             for (const [key, value] of Object.entries(queryParams)) {
//                 params.append(key, value);
//             }
//             const config = {
//                 headers: headers,
//             }
//             try {
//                 if (_buildURL) {
//                     url = this.buildURL(url);
//                 }
//                 const res = await axios.get(url, config);
//                 const resData: Record<any, any> = res.data;
//                 SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(resData)}`);
//                 return resData;
//             } catch (error) {
//                 if (axios.isAxiosError(error) && error.response) {
//                     SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(error.response.data)}`)}`)
//                 } else {
//                     SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(error)}`)}`);
//                 }
//                 SimbaConfig.log.debug(`err: ${JSON.stringify(error)}`);
//                 if (axios.isAxiosError(error) && error.response && error.response.status === 401)  {
//                     SimbaConfig.log.debug(`:: received 401 response, attempting to refresh token`);
//                     // if 401 from Simba, then try refreshing token.
//                     try {
//                         const newAuthToken = await this.refreshToken();
//                         if (newAuthToken) {
//                             SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: new token acquired. Please try your request again`)}`)
//                             return;
//                         } else {
//                             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: there was a problem acquiring your access token. Please log out and then login and then try your request again`)}`);
//                             return;
//                         }
//                     } catch (e) {
//                         if (axios.isAxiosError(e) && e.response) {
//                             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e.response.data)}`)}`)
//                         } else {
//                             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e)}`)}`);
//                         }
//                         try {
//                             SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: you need to login again; redirecting you to login. Then please try your request again.`)}`);
//                             await this.loginAndGetAuthToken(false);
//                             return;
//                         } catch (e) {
//                             if (axios.isAxiosError(e) && e.response) {
//                                 SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e.response.data)}`)}`)
//                             } else {
//                                 SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e)}`)}`);
//                             }
//                             const err = e as any;
//                             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : there was a problem with your request. Please log out and then login and then try your request again`)}`);
//                             return err;
//                         }
//                     }
//                 } else {
//                     SimbaConfig.log.error(`${chalk.redBright(`simba: there was a problem with your request. To view debug logs, please set your loglevel to debug and try your request again.`)}`);
//                     return error as Error;
//                 }
                
//             }
//         } else {
//             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
//             return new Error(`${this.authErrors.authTokenError}`);
//         }
//     }

//     /**
//      * keycloak expects a different contentType (see below)
//      * @param url 
//      * @param _queryParams 
//      * @returns 
//      */
//     public async doKeycloakGetRequest(
//         url: string,
//         _queryParams?: Record<any, any>,
//     ): Promise<Record<any, any> | Error | void> {
//         const funcParams = {
//             url,
//             _queryParams,
//         };
//         SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
//         const contentType = 'application/x-www-form-urlencoded;charset=utf-8';
//         const resData = await this.doGetRequest(url, contentType, _queryParams, false);
//         if (resData instanceof Error || axios.isAxiosError(resData)) {
//             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(resData)}`)}`);
//             return resData;
//         }
//         SimbaConfig.log.debug(`:: EXIT : result data : ${JSON.stringify(resData)}`);
//         return resData;
//     }

//     /**
//      * do post request. uses axios library
//      * @param url 
//      * @param _postData 
//      * @param contentType 
//      * @param _buildURL 
//      * @returns 
//      */
//     public async doPostRequest(
//         url: string,
//         _postData?: Record<any, any>,
//         contentType?: string,
//         _buildURL: boolean = true,
//     ): Promise<Record<any, any> | void> {
//         const funcParams = {
//             url,
//             _postData,
//             contentType,
//         };
//         SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
//         if (this.tokenExpired()) {
//             SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: auth token expired`)}`);
//             if (this.refreshTokenExpired()) {
//                 SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refresh token expired, acquiring new auth token`)}`);
//                 const authToken = await this.loginAndGetAuthToken();
//                 if (!authToken) {
//                     SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
//                     return new Error(`${this.authErrors.authTokenError}`);
//                 }
//             } else {
//                 SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: refreshing token`)}`);
//                 const newAuthToken = await this.refreshToken();
//                 if (!newAuthToken) {
//                     SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`)
//                     SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: there was an error with your request, please log out and then login again, then try your request again`)}`);
//                     return
//                 }
//             }
//         }
//         const postData = _postData ? _postData : {};
//         const headers = await this.accessTokenHeader();
//         if (headers) {
//             if (!contentType) {
//                 headers["content-type"] = "application/json";
//             } else {
//                 headers["content-type"] = contentType;
//             }
//             const config = {
//                 headers: headers,
//             }
//             try {
//                 if (_buildURL) {
//                     url = this.buildURL(url);
//                 }
//                 const res = await axios.post(url, postData, config);
//                 const resData: Record<any, any> = res.data;
//                 SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(resData)}`);
//                 return resData;
//             } catch (error) {
//                 if (axios.isAxiosError(error) && error.response) {
//                     SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(error.response.data)}`)}`)
//                 } else {
//                     SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(error)}`)}`);
//                 }
//                 SimbaConfig.log.debug(`err: ${JSON.stringify(error)}`);
//                 if (axios.isAxiosError(error) && error.response && error.response.status === 401)  {
//                     SimbaConfig.log.debug(`:: received 401 response, attempting to refresh token`);
//                     // if 401 from Simba, then try refreshing token.
//                     try {
//                         const newAuthToken = await this.refreshToken();
//                         if (newAuthToken) {
//                             SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: new token acquired. Please try your request again`)}`)
//                             return;
//                         } else {
//                             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: there was a problem acquiring your access token. Please log out and then login and then try your request again`)}`);
//                             return;
//                         }
//                     } catch (e) {
//                         if (axios.isAxiosError(e) && e.response) {
//                             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e.response.data)}`)}`)
//                         } else {
//                             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e)}`)}`);
//                         }
//                         try {
//                             SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: you need to login again; redirecting you to login. Then please try your request again.`)}`);
//                             await this.loginAndGetAuthToken(false);
//                             return;
//                         } catch (e) {
//                             if (axios.isAxiosError(e) && e.response) {
//                                 SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e.response.data)}`)}`)
//                             } else {
//                                 SimbaConfig.log.error(`${chalk.redBright(`\nsimba: ${JSON.stringify(e)}`)}`);
//                             }
//                             const err = e as any;
//                             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : there was a problem with your request. Please log out and then login and then try your request again`)}`);
//                             return err;
//                         }
//                     }
//                 } else {
//                     SimbaConfig.log.error(`${chalk.redBright(`simba: there was a problem with your request. To view debug logs, please set your loglevel to debug and try your request again.`)}`);
//                     return error as Error;
//                 }
//             }
//         } else {
//             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.headersError}`)}`);
//             return new Error(`${this.authErrors.headersError}`);
//         }
//     }

//     /**
//      * keycloak expects different contentType
//      * @param url 
//      * @param _postData 
//      * @returns 
//      */
//     public async doKeycloakPostRequest(
//         url: string,
//         _postData?: Record<any, any>
//     ): Promise<Record<any, any> | Error | void> {
//         const funcParams = {
//             url,
//             _postData,
//         };
//         SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
//         const contentType = 'application/x-www-form-urlencoded;charset=utf-8';
//         const resData = await this.doPostRequest(url, _postData, contentType, false);
//         if (resData instanceof Error) {
//             SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(resData)}`)}`);
//             return resData;
//         }
//         SimbaConfig.log.debug(`:: EXIT : result data : ${JSON.stringify(resData)}`);
//         return resData;
//     }

//     private base64URL(str: string): string {
//         return str
//             .replace(/=/g, '')
//             .replace(/\+/g, '-')
//             .replace(/\//g, '_');
//     }
// }

class AzureHandler {
    private readonly closeTimeout: number = 5 * 1000;
    private port = 22315;
    private server: http.Server | null = null;
    private state: string | undefined;
    private redirectURI: string | undefined;

    private pkceVerifier: string | undefined;
    private pkceChallenge: string | undefined;
    private config: Configstore;
    private projectConfig: Configstore;
    private authURL: string;
    private baseURL: string;
    private verificationInfo: KeycloakDeviceVerificationInfo;
    private tokenExpirationPad: number;
    private configBase: string;
    private authErrors: AuthErrors;
    private _loggedIn: boolean;

    // PROBABLY NOT HARDCODING FOLLOWING LINES IN PRODUCTION:
    private clientID: string = "3906ab4c-b1fd-43f8-95e5-ab95efee26cf";
    private tenant: string = "simbadevblocks";
    private policy: string = "B2C_1_Signin_Signup";
    private scope = `${this.clientID} offline_access`;
    // private _authorizeUrl: string = `https://${this.tenant}.b2clogin.com/${this.tenant}.onmicrosoft.com/oauth2/v2.0/authorize?p=${this.policy}`
    private _authorizeUrl: string = `https://${this.tenant}.b2clogin.com/${this.tenant}.onmicrosoft.com/${this.policy}/oauth2/v2.0/authorize`;
    private tokenURL: string = `https://${this.tenant}.b2clogin.com/${this.tenant}.onmicrosoft.com/${this.policy}/oauth2/v2.0/token`;
    constructor(
        config?: Configstore,
        projectConfig?: Configstore,
    ) {
        this.authErrors = KeycloakAuthErrors;
        this.config = SimbaConfig.ConfigStore;
        this.projectConfig = SimbaConfig.ProjectConfigStore;
        this.baseURL = this.projectConfig.get('baseURL') ? this.projectConfig.get('baseURL') : this.projectConfig.get('baseUrl');
        if (!this.baseURL) {
            SimbaConfig.log.error(`:: ${this.authErrors.noBaseURLError}`);
        }
        this.configBase = this.baseURL.split(".").join("_");
        // this.scope = encodeURIComponent(this.scope)
        console.log("this.scope: ", this.scope)
    }

    public get authorizeUrl(): string {
        this.generatePKCE();
        return `${this._authorizeUrl}?client_id=${this.clientID}&redirect_uri=${this.redirectURI}&response_type=code&state=${this.state}&scope=${this.scope}&code_challenge=${this.pkceChallenge}&code_challenge_method=S256`;
    }

    protected getConfigBase(): string {
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

    public get isLoggedIn(): boolean {
        return this.hasConfig(AUTHKEY);
    }

    public async performLogin(): Promise<any> {
        this.state = cryptoRandomString({length: 24, type: 'url-safe'});

        return this.loginAndGetAuthToken();
    }

    public closeServer(): void {
        setTimeout(() => {
            if (this.server) {
                this.server.close();
            }
        }, this.closeTimeout);
    }

    public async loginAndGetAuthToken(): Promise<any> {
        return new Promise<void>((resolve, reject) => {
            // clear out old auth
            this.deleteConfig(AUTHKEY);

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
                .get('/auth-callback/', (req: Request | any, res: http.ServerResponse) => {
                    const code: string = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
                    const state: string = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
                    const error: string = Array.isArray(req.query.error) ? req.query.error[0] : req.query.error;

                    res.on('finish', () => {
                        this.closeServer();
                    });

                    this.receiveCode(code, state, error)
                        .then(() => {
                            res.writeHead(302, {Location: '/'});
                            res.end();
                        })
                        .catch((err: Error) => {
                            res.writeHead(302, {Location: `/?error=${Buffer.from(err as any).toString('base64')}`});
                            res.end();
                        });
                })
                .get('/', (_req: Request | any, res: http.ServerResponse) => {
                    res.writeHead(200, {
                        'Content-Length': authHtml.length,
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                    res.end(authHtml.toString());
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

    public refreshToken(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const auth: any = this.getConfig(AUTHKEY);
            if (auth) {
                if (!auth.refresh_token) {
                    this.deleteConfig(AUTHKEY);
                    reject(new Error('Not authenticated!'));
                }
                if ('expires_at' in auth) {
                    const expiresAt = new Date(auth.expires_at);
                    if (expiresAt <= new Date()) {
                        const option = {
                            uri: this.tokenURL,
                            method: 'POST',
                            json: true,
                            form: {
                                client_id: this.clientID,
                                grant_type: 'refresh_token',
                                refresh_token: auth.refresh_token,
                            },
                        };

                        request
                            .post(option)
                            .then((resp) => {
                                this.setConfig(AUTHKEY, this.parseExpiry(resp));

                                resolve(true);
                            })
                            .catch((err: Error) => {
                                reject(err);
                            });
                    } else {
                        // Refresh not required
                        resolve(false);
                    }
                } else {
                    // Refresh not required
                    resolve(false);
                }
            } else {
                reject(new Error('Not authenticated!'));
            }
        });
    }

    public parseExpiry(auth: any): any {
        if ('expires_in' in auth) {
            const retrievedAt = new Date();
            const expiresIn = parseInt(auth.expires_in, 10) * 1000;
            const expiresAt = new Date(Date.parse(retrievedAt.toISOString()) + expiresIn);

            auth.retrieved_at = retrievedAt.toISOString();
            auth.expires_at = expiresAt.toISOString();
        }
        return auth;
    }

    public async receiveCode(code: string, state: string, error: string): Promise<any> {
        SimbaConfig.log.info(`entering receiveCode:`)
        if (state !== this.state) {
            SimbaConfig.log.error(chalk.red('Error logging in to SIMBAChain: state does not match'));
            return Promise.reject('Error logging in to SIMBAChain: state does not match');
        } else if (error) {
            console.log('our error: ', error)
            SimbaConfig.log.error(chalk.red('Unknown Error logging in to SIMBAChain: ' + error));
            return Promise.reject('Unknown Error logging in to SIMBAChain: ' + error);
        } else if (!code) {
            SimbaConfig.log.error(chalk.red('Error logging in to SIMBAChain: missing auth code'));
            return Promise.reject('Error logging in to SIMBAChain: missing auth code');
        } else {
            SimbaConfig.log.info(`past error checks`)
            let uri = '';
            if (this.redirectURI) {
                uri = decodeURIComponent(this.redirectURI);
            }
            SimbaConfig.log.info(`tokenURL: `, this.tokenURL);
            const option = {
                uri: this.tokenURL,
                method: 'POST',
                json: true,
                form: {
                    grant_type: 'authorization_code',
                    redirect_uri: decodeURIComponent(uri),
                    code_verifier: this.pkceVerifier,
                    scope: this.scope,
                    client_id: this.clientID,
                    code,
                },
            };

            SimbaConfig.log.info(`option: ${JSON.stringify(option)}`);

            return request
                .post(option)
                .then(async (resp) => {
                    this.setConfig(AUTHKEY, this.parseExpiry(resp));

                    SimbaConfig.log.info(chalk.green('Logged In!'));
                })
                .catch(async (err: Error) => {
                    SimbaConfig.log.error(chalk.red('Error logging in to SIMBAChain: Token Exchange Error: ' + err));
                    return Promise.reject('Error logging in to SIMBAChain: Token Exchange Error:' + err);
                });
        }
    }

    public getClientOptions(url: string, contentType = 'application/json', data?: any): Promise<any> {
        const auth = this.getConfig(AUTHKEY);
        if (!url.startsWith('http')) {
            url = this.baseURL + url;
        }

        return this.refreshToken().then(() => {
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
        });
    }

    public async doGetRequest(url: string, contentType?: string): Promise<any> {
        return this.retryAfterTokenRefresh(url, request.get, contentType);
    }

    public async doPostRequest(url: string, data: any, contentType?: string): Promise<any> {
        return this.retryAfterTokenRefresh(url, request.post, contentType, data);
    }

    public logout(): void {
        this.deleteConfig(AUTHKEY);
    }

    protected hasConfig(key: string): boolean {
        if (!this.config.has(this.configBase)) {
            return false;
        }

        return key in this.config.get(this.configBase);
    }

    protected getConfig(key: string): any {
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
        if (!this.hasConfig(key)) {
            this.setConfig(key, value);
            return value;
        }

        return this.getConfig(key);
    }

    protected setConfig(key: string, value: any): any {
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
        if (!this.config.has(this.baseURL.replace('.', '_'))) {
            return;
        }

        const dict = this.config.get(this.configBase);

        if (!(key in dict)) {
            return;
        }

        delete dict[key];

        this.config.set(this.configBase, dict);
    }

    protected generatePKCE(): void {
        this.pkceVerifier = cryptoRandomString({length: 128, type: 'url-safe'});
        const hash = CryptoJS.SHA256(this.pkceVerifier);
        const b64 = this.base64URL(hash.toString(CryptoJS.enc.Base64));
        this.pkceChallenge = b64;
    }

    private async retryAfterTokenRefresh(
        url: string,
        call: (opts: any) => request.RequestPromise<any>,
        contentType?: string,
        data?: any,
    ): Promise<any> {
        let opts = await this.getClientOptions(url, contentType, data);

        try {
            return call(opts);
        } catch (err) {
            const e = err as any; 
            if (e.statusCode === 403 || e.statusCode === '403') {
                await this.refreshToken();
                opts = await this.getClientOptions(url, contentType, data);
                return call(opts);
            }
            if ('errors' in e && Array.isArray(e.errors)) {
                if (
                    e.errors[0].status === '403' &&
                    e.errors[0].code === '1403' &&
                    e.errors[0].detail === '{"error":"Access token not found"}\n'
                ) {
                    await this.refreshToken();
                    opts = await this.getClientOptions(url, contentType, data);
                    return call(opts);
                }
            }
            throw e;
        }
    }

    private base64URL(str: string): string {
        return str
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }
}

export {
    KeycloakHandler,
    AzureHandler,
    AuthProviders,
}