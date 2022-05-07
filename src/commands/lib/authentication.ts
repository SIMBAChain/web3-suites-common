/*
NOTE:
this file will actually come from the standalone web3 repo
it is just included here for now for testing purposes
*/
import Configstore from "configstore";
import {
    SimbaConfig,
    log,
} from "../lib";
import {default as chalk} from 'chalk';
import axios from "axios";
import {
    URLSearchParams,
} from "url";

const CLIENT_ID = "simba-pkce";
const AUTH_URL = "https://simba-dev-sso.platform.simbachain.com";
const REALM = "simbachain";
// export const AUTHKEY = "SIMBAAUTH";

interface PollingConfig {
    maxAttempts: number;
    interval: number;
}

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

const KeycloakAuthErrors: AuthErrors = {
    headersError: `${chalk.red('simba: Error acquiring auth headers. Please make sure keycloak certs are not expired.')}`,
    keycloakCertsError: `${chalk.red('simba: Error obtaining certs from keycloak. Please make sure keycloak certs are not expired.')}`,
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

class KeycloakHandler {
    private config: Configstore;
    private projectConfig: Configstore;
    private clientID: string;
    private authURL: string;
    private baseURL: string;
    private realm: string;
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
        this.clientID = this.projectConfig.get('clientID') ? this.projectConfig.get('clientID') : this.projectConfig.get('clientId');
        if (!this.clientID) {
            log.error(`:: ${this.authErrors.noClientIDError}`);
        }
        this.baseURL = this.projectConfig.get('baseURL') ? this.projectConfig.get('baseURL') : this.projectConfig.get('baseUrl');
        if (!this.baseURL) {
            log.error(`:: ${this.authErrors.noBaseURLError}`);
        }
        this.authURL = this.projectConfig.get('authURL') ? this.projectConfig.get('authURL') : this.projectConfig.get('authUrl');
        if (!this.authURL) {
            log.error(`:: ${this.authErrors.noAuthURLError}`);
        }
        this.realm = this.projectConfig.get('realm');
        if (!this.realm) {
            log.error(`:: ${this.authErrors.noRealmError}`);
        }
        this.configBase = this.baseURL.split(".").join("_");
        this.tokenExpirationPad = tokenExpirationPad;
        
    }

    protected getConfigBase(): string {
        if (!this.configBase) {
            this.configBase = this.baseURL.split(".").join("_");
        }
        return this.configBase;
    }

    public setLoggedInStatus(status: boolean): void {
        this._loggedIn = status;
    }

    public isLoggedIn(): boolean {
        if (this.verificationInfo) {
            return true;
        } else {
            return false;
        }
    }

    public async logout(): Promise<void> {
        this.setLoggedInStatus(false);
        this.deleteAuthInfo();
    }

    protected deleteAuthInfo(): void {
        log.debug(`:: ENTER : deleting any existing authToken info`);
        this.config.set(this.configBase, {});
    }

    protected getPathToConfigFile(): string {
        return this.config.path;
    }

    protected hasConfig(key: string): boolean {
        if (!this.config.has(this.configBase)) {
            return false;
        }
        return key in this.config.get(this.getConfigBase());
    }

    protected getConfig(key: string): any {
        if (!this.config.has(this.configBase)) {
            return;
        }
        const dict = this.config.get(this.getConfigBase());
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
        log.debug(`:: ENTER : KEY: ${key}, VALUE: ${JSON.stringify(value)}`);
        if (!this.config.has(this.configBase)) {
            this.config.set(this.configBase, {});
        }
        const dict = this.config.get(this.configBase);
        dict[key] = value;
        this.config.set(this.configBase, dict);
        log.debug(`:: EXIT : this.config: ${JSON.stringify(this.config)}`);
        return value;
    }

    protected deleteConfig(key: string): void {
        if (!this.config.has(this.configBase)) {
            return;
        }
        const dict = this.config.get(this.configBase);
        if (!(key in dict)) {
            return;
        }
        delete dict[key];
        this.config.set(this.configBase, dict);
    }

    private async getVerificationInfo(): Promise<KeycloakDeviceVerificationInfo | Error> {
        log.debug(`:: ENTER :`);
        const url = `${this.authURL}/auth/realms/${this.realm}/protocol/openid-connect/auth/device`;
        const params = new URLSearchParams();
        params.append('client_id', this.clientID);
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
            log.debug(`:: EXIT : ${JSON.stringify(this.verificationInfo)}`);
            return verificationInfo;
        } catch (error) {
            log.error(`${chalk.redBright(`simba: EXIT : ${JSON.stringify(error)}`)}`);
            return error as Error;
        }
    }

    public async loginUser(): Promise<void | string> {
        log.debug(`:: ENTER :`);
        if (!this.isLoggedIn()) {
            this.verificationInfo = await this.getVerificationInfo() as KeycloakDeviceVerificationInfo;
        }
        const verificationCompleteURI = this.verificationInfo.verification_uri_complete;
        // the following line is where we begin the flow of handling not acquiring verification info
        if (!verificationCompleteURI) {
            log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.keycloakCertsError}`)}`);
            return
        }
        log.info(`\n${chalk.cyanBright('\nsimba: Please navigate to the following URI to log in: ')} ${chalk.greenBright(verificationCompleteURI)}`);
        log.debug(`:: EXIT :`);
        return verificationCompleteURI;
    }

    public async getAuthToken(
        pollingConfig: PollingConfig = {
            maxAttempts: 60,
            interval: 3000,
        },
        refreshing: boolean = false,
    ): Promise<KeycloakAccessToken | void> {
        log.debug(`:: ENTER :`);
        const maxAttempts = pollingConfig.maxAttempts;
        const interval = pollingConfig.interval;
        if (!this.isLoggedIn()) {
            this.verificationInfo = await this.getVerificationInfo() as KeycloakDeviceVerificationInfo;
        }
        if (!this.verificationInfo) {
            log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.verificationInfoError}`)}`);
            return;
        }
        const deviceCode = this.verificationInfo.device_code;
        const params = new URLSearchParams();
        const url = `${this.authURL}/auth/realms/${this.realm}/protocol/openid-connect/token`;
        const headers = {
            'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
        };
        const config = {
            headers: headers,
        }
        if (!refreshing) {
            params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
            params.append("client_id", this.clientID);
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
                    log.debug(`:: EXIT : ${JSON.stringify(authToken)}`);
                    return authToken;
                } catch (error) {
                    if (attempts%5 == 0) {
                        log.info(`${chalk.cyanBright(`\nsimba: still waiting for user to login...`)}`);
                    }
                    attempts += 1;
                }
            }
            log.debug(`:: EXIT : attempts exceeded, timedout`);
            return
        } else {
            log.debug(`:: entering refresh logic`);
            const authToken = this.getConfig("authToken");
            log.debug(`:: auth!! : ${JSON.stringify(authToken)}`);
            const _refreshToken = authToken.refresh_token;
            params.append("client_id", this.clientID);
            params.append("grant_type", "refresh_token");
            params.append("refresh_token", _refreshToken);
            await new Promise(resolve => setTimeout(resolve, interval));
            try {
                let response = await axios.post(url, params, config);
                const newAuthToken: KeycloakAccessToken = response.data;
                newAuthToken.expires_at = Math.floor(Date.now() / 1000) + newAuthToken.expires_in;
                newAuthToken.refresh_expires_at = Math.floor(Date.now() / 1000) + newAuthToken.refresh_expires_in;
                this.setConfig("authToken", newAuthToken);
                log.debug(`:: EXIT : ${JSON.stringify(newAuthToken)}`);
                return newAuthToken;
            } catch (error) {
                log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`)
                return;
            }
        }
    }

    public tokenExpired(): boolean {
        log.debug(`:: ENTER :`);
        if (!this.hasConfig("authToken")) {
            log.debug(`:: EXIT : no authToken exists, exiting with true`);
            return true;
        }
        const authToken = this.getConfig("authToken");
        if (!authToken.expires_at) {
            log.debug(`:: EXIT : true`);
            return true;
        }
        // return true below, to pad for time required for operations
        if (authToken.expires_at < Math.floor(Date.now()/1000) - this.tokenExpirationPad) {
            log.debug(`:: EXIT : access_token expiring within 60 seconds, returning true`);
            return true;
        }
        log.debug(`:: EXIT : false`);
        return false;
    }

    public refreshTokenExpired(): boolean {
        log.debug(`:: ENTER :`);
        if (!this.hasConfig("authToken")) {
            log.debug(`:: EXIT : true`);
            return true;
        }
        const authToken = this.getConfig("authToken");
        if (!authToken.refresh_expires_at) {
            log.debug(`:: EXIT : true`);
            return true;
        }
        // return true below, to pad for time required for operations
        if (authToken.refresh_expires_at <= Math.floor(Date.now()/1000) - this.tokenExpirationPad) {
            log.debug(`:: EXIT : access_token expiring within 60 seconds, returning true`);
            return true;
        }
        log.debug(`:: EXIT : false`);
        return false;
    }

    public async refreshToken(): Promise<KeycloakAccessToken | void> {
        log.debug(`:: ENTER :`);
        if (!this.tokenExpired()) {
            log.debug(`:: EXIT : authToken still valid`);
            return;
        }
        if (this.refreshTokenExpired()) {
            this.deleteAuthInfo();
            const authToken = await this.loginAndGetAuthToken();
            if (authToken) {
                log.debug(`:: EXIT : ${JSON.stringify(authToken)}`);
                return authToken;
            } else {
                log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
                return;
            }
        }
        log.debug(`:: entering logic to refresh token`);
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
            log.debug(`:: EXIT : ${JSON.stringify(newAuthToken)}`);
            return newAuthToken;
        } else {
            log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
            return;
        }
    }

    public async loginAndGetAuthToken(
        refreshing: boolean = false,
    ): Promise<KeycloakAccessToken | void> {
        log.debug(`:: ENTER :`);
        let verificationCompleteURI;
        if (!refreshing) {
            this.logout();
            verificationCompleteURI = await this.loginUser();
        }
        if (verificationCompleteURI) {
            const pollingConfig: PollingConfig = {
                maxAttempts: 60,
                interval: 3000,
            };
            const authToken = await this.getAuthToken(pollingConfig, refreshing) as KeycloakAccessToken;
            log.debug(`:: EXIT : authToken : ${JSON.stringify(authToken)}`);
            this.setLoggedInStatus(true);
            return authToken;
        } else {
            log.debug(`:: EXIT : ${this.authErrors.verificationInfoError}`);
            return;
        }
    }

    public async accessTokenHeader(): Promise<Record<any, any> | void> {
        log.debug(`:: ENTER :`);
        let authToken = this.getConfig("authToken");
        if (!authToken) {
            authToken = await this.loginAndGetAuthToken(false);
        }
        if (authToken) {
            const accessToken = authToken.access_token;
            const headers = {
                Authorization: `Bearer ${accessToken}`,
            };
            log.debug(`:: EXIT : headers: ${JSON.stringify(headers)}`);
            return headers;
        } else {
            log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
            return;
        }
    }

    public buildURL(
        urlExtension: string,
    ): string {
        log.debug(`:: ENTER : ${urlExtension}`);
        let baseURL = this.baseURL.endsWith("/") ? this.baseURL : this.baseURL + "/";
        baseURL = baseURL.endsWith("v2/") ? baseURL : baseURL.slice(0, -1) + "v2/";
        const fullURL = baseURL + urlExtension;
        log.debug(`:: EXIT : ${fullURL}`);
        return fullURL;
    }

    public async doGetRequest(
        url: string,
        contentType?: string,
        _queryParams?: Record<any, any>,
        _buildURL: boolean = true,
    ): Promise<Record<any, any> | Error> {
        const funcParams = {
            url,
            _queryParams,
            contentType,
        }
        log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
        if (this.tokenExpired()) {
            if (this.refreshTokenExpired()) {
                log.info(`:: INFO : token expired, please log in again`);
                const authToken = await this.loginAndGetAuthToken();
                if (!authToken) {
                    log.error(`${chalk.red(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
                    return new Error(`${this.authErrors.authTokenError}`);
                }
            } else {
                log.info(`:: INFO : refreshing token`);
                const newAuthToken = await this.refreshToken();
                if (!newAuthToken) {
                    log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`)
                    return new Error(`${this.authErrors.authTokenError}`);
                }
            }
        }
        const queryParams = _queryParams ? _queryParams : {};
        const headers = await this.accessTokenHeader();
        if (headers) {
            if (!contentType) {
                headers["accept"] = "application/json";
            } else {
                headers["content-type"] = contentType;
            }
            const params = new URLSearchParams();
            params.append('client_id', this.clientID);
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
                log.debug(`:: EXIT : ${JSON.stringify(resData)}`);
                return resData;
            } catch (error) {
                log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
                return error as Error;
            }
        } else {
            log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
            return new Error(`${this.authErrors.authTokenError}`);
        }
    }

    public async doKeycloakGetRequest(
        url: string,
        _queryParams?: Record<any, any>,
    ): Promise<Record<any, any> | Error> {
        const funcParams = {
            url,
            _queryParams,
        };
        log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
        const contentType = 'application/x-www-form-urlencoded;charset=utf-8';
        const resData = await this.doGetRequest(url, contentType, _queryParams, false);
        if (resData instanceof Error) {
            log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(resData)}`)}`);
            return resData;
        }
        log.debug(`:: EXIT : result data : ${JSON.stringify(resData)}`);
        return resData;
    }

    public async doPostRequest(
        url: string,
        _postData?: Record<any, any>,
        contentType?: string,
        _buildURL: boolean = true,
    ): Promise<Record<any, any>> {
        const funcParams = {
            url,
            _postData,
            contentType,
        };
        log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
        if (this.tokenExpired()) {
            if (this.refreshTokenExpired()) {
                log.info(`:: INFO : token expired, please log in again`);
                const authToken = await this.loginAndGetAuthToken();
                if (!authToken) {
                    log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`);
                    return new Error(`${this.authErrors.authTokenError}`);
                }
            } else {
                log.info(`:: INFO : refreshing token`);
                const newAuthToken = await this.refreshToken();
                if (!newAuthToken) {
                    log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.authTokenError}`)}`)
                    return new Error(`${this.authErrors.authTokenError}`);
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
                log.debug(`:: EXIT : ${JSON.stringify(resData)}`);
                return resData;
            } catch (error) {
                log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
                return error as Error;
            }
        } else {
            log.error(`${chalk.redBright(`\nsimba: EXIT : ${this.authErrors.headersError}`)}`);
            return new Error(`${this.authErrors.headersError}`);
        }
    }

    public async doKeycloakPostRequest(
        url: string,
        _postData?: Record<any, any>
    ): Promise<Record<any, any> | Error> {
        const funcParams = {
            url,
            _postData,
        };
        log.debug(`:: ENTER : ${JSON.stringify(funcParams)}`);
        const contentType = 'application/x-www-form-urlencoded;charset=utf-8';
        const resData = await this.doPostRequest(url, _postData, contentType, false);
        if (resData instanceof Error) {
            log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(resData)}`)}`);
            return resData;
        }
        log.debug(`:: EXIT : result data : ${JSON.stringify(resData)}`);
        return resData;
    }
}

export {
    KeycloakHandler,
    CLIENT_ID,
    AUTH_URL,
    REALM,
}