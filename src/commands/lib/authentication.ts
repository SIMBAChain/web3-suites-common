import Configstore from "configstore";
import {
    SimbaConfig,
} from "../lib";
import {default as chalk} from 'chalk';
import axios from "axios";
import {
    AxiosError
} from "axios";
import {
    URLSearchParams,
} from "url";

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

/**
 * This class handles our login for keycloak device login
 * In the future, when we decide to introduce other auth flows,
 * then we should have a similar class for other auth flows
 */
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
            SimbaConfig.log.error(`:: ${this.authErrors.noClientIDError}`);
        }
        this.baseURL = this.projectConfig.get('baseURL') ? this.projectConfig.get('baseURL') : this.projectConfig.get('baseUrl');
        if (!this.baseURL) {
            SimbaConfig.log.error(`:: ${this.authErrors.noBaseURLError}`);
        }
        this.authURL = this.projectConfig.get('authURL') ? this.projectConfig.get('authURL') : this.projectConfig.get('authUrl');
        if (!this.authURL) {
            SimbaConfig.log.error(`:: ${this.authErrors.noAuthURLError}`);
        }
        this.realm = this.projectConfig.get('realm');
        if (!this.realm) {
            SimbaConfig.log.error(`:: ${this.authErrors.noRealmError}`);
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
                    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(authToken)}`);
                    return authToken;
                } catch (error) {
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

export {
    KeycloakHandler,
}