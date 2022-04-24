import Configstore from "configstore";
import axios from "axios";
import {
    Logger,
} from "tslog";
import {
    URLSearchParams,
} from "url";
const log: Logger = new Logger();

const CLIENT_ID = "simba-pkce";
const AUTH_URL = "https://simba-dev-sso.platform.simbachain.com";
const REALM = "simbachain";

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
    interval: number;
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
    private tokenURL: string;
    private baseURL: string;
    private realm: string;
    private verificationInfo: KeycloakDeviceVerificationInfo;
    private accessToken: KeycloakAccessToken;
    private tokenExpirationPad: number;
    // private _configBase: string;
    constructor(
        config: Configstore,
        projectConfig: Configstore,
        tokenExpirationPad: number = 60,
    ) {
        this.config = config;
        this.projectConfig = projectConfig;
        this.clientID = this.projectConfig.get('clientID');
        this.baseURL = this.projectConfig.get('baseURL') ? this.projectConfig.get('baseURL') : this.projectConfig.get('baseUrl');
        this.authURL = this.projectConfig.get('authURL') ? this.projectConfig.get('authURL') : this.projectConfig.get('authUrl');
        this.tokenURL = this.projectConfig.get('tokenURL') ? this.projectConfig.get('tokenURL') : this.projectConfig.get('tokenUrl');
        this.realm = this.projectConfig.get('realm');
        this.tokenExpirationPad = tokenExpirationPad;
        log.debug(`vars from projectConfig:
        baseURL: ${this.baseURL},
        tokenURL: ${this.tokenURL},
        realm: ${this.realm},
        authURL: ${this.authURL},
        clientID: ${this.clientID}`);
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
            console.log("url for verificationInfo: ", url);
            const res = await axios.post(url, params, config);
            const verificationInfo: KeycloakDeviceVerificationInfo = res.data;
            this.verificationInfo = verificationInfo;
            log.debug(`:: EXIT : ${JSON.stringify(this.verificationInfo)}`);
            return verificationInfo;
        } catch (error) {
            log.error(`:: EXIT : ERROR : ${JSON.stringify(error)}`);
            return error as Error;
        }
    }

    public async loginUser(): Promise<void> {
        log.debug(`:: ENTER :`);
        if (!this.verificationInfo) {
            this.verificationInfo = await this.getVerificationInfo() as KeycloakDeviceVerificationInfo;
        }
        const verificationURI = this.verificationInfo.verification_uri;
        const userCode = this.verificationInfo.user_code;
        console.log(`\nYour keycloak user_code is ${userCode}\n\nIn your browser, please navigate to the following URL and enter your user_code: ${verificationURI}`);
        log.debug(`:: EXIT :`);
    }

    public async getAccessToken(
        pollingConfig: PollingConfig = {
            maxAttempts: 60,
            interval: 3000,
        }
    ): Promise<KeycloakAccessToken | Error> {
        log.debug(`:: ENTER :`);
        const maxAttempts = pollingConfig.maxAttempts;
        const interval = pollingConfig.interval;
        if (!this.verificationInfo) {
            this.verificationInfo = await this.getVerificationInfo() as KeycloakDeviceVerificationInfo;
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
        params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
        params.append("client_id", this.clientID);
        params.append("device_code", deviceCode);
        let attempts = 0;
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, interval));
            try {
                let response = await axios.post(url, params, config);
                const accessToken: KeycloakAccessToken = response.data
                log.debug(`:: EXIT : ${JSON.stringify(accessToken)}`);
                accessToken.expires_at = Math.floor(Date.now() / 1000) + accessToken.expires_in;
                accessToken.refresh_expires_at = Math.floor(Date.now() / 1000) + accessToken.refresh_expires_in;
                this.accessToken = accessToken;;
                return accessToken;
            } catch (error) {
                if (attempts%5 == 0) {
                    log.info(`still waiting for user to login`)
                }
                attempts += 1;
            }
        }
        log.debug(`:: EXIT : attempts exceeded, timedout`);
        return new Error("attempts exceeded, timedout");
    }

    public tokenExpired(): boolean {
        log.debug(`:: ENTER :`);
        log.debug(`:: accessToken: ${JSON.stringify(this.accessToken)}`);
        if (!this.accessToken) {
            log.debug(`:: EXIT : true`);
            return true;
        }
        if (!this.accessToken.expires_at) {
            log.debug(`:: EXIT : true`);
            return true;
        }
        // return true below, to pad for time required for operations
        if (this.accessToken.expires_at < Math.floor(Date.now()/1000) - this.tokenExpirationPad) {
            log.debug(`:: EXIT : access_token expiring within 60 seconds, returning true`);
            return true;
        }
        log.debug(`:: EXIT : false`);
        return false;
    }

    public refreshTokenExpired(): boolean {
        log.debug(`:: ENTER :`);
        if (!this.accessToken) {
            log.debug(`:: EXIT : true`);
            return true;
        }
        if (!this.accessToken.refresh_expires_at) {
            log.debug(`:: EXIT : true`);
            return true;
        }
        // return true below, to pad for time required for operations
        if (this.accessToken.refresh_expires_at < Math.floor(Date.now()/1000) - this.tokenExpirationPad) {
            log.debug(`:: EXIT : access_token expiring within 60 seconds, returning true`);
            return true;
        }
        log.debug(`:: EXIT : false`);
        return false;
    }

    public async refreshToken(): Promise<void> {
        log.error(":: ERROR : refreshToken not yet implemented");
    }

    public async loginUserAndGetAccessToken(): Promise<KeycloakAccessToken> {
        log.debug(`:: ENTER :`);
        await this.loginUser();
        if (!this.accessToken) {
            await this.getAccessToken() as KeycloakAccessToken;
        }
        log.debug(`:: EXIT : accessToken : ${JSON.stringify(this.accessToken)}`);
        return this.accessToken
    }

    public async accessTokenHeader(): Promise<Record<any, any>> {
        log.debug(`:: ENTER :`);
        if (!this.accessToken) {
            await this.loginUserAndGetAccessToken();
        }
        const accessTokenValue = this.accessToken.access_token;
        const headers = {
            Authorization: `Bearer ${accessTokenValue}`,
        };
        log.debug(`:: EXIT : headers: ${JSON.stringify(headers)}`);
        return headers;
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
            log.debug(`:: tokenExpired: ${true}`);
            if (this.refreshTokenExpired()) {
                log.info(`:: INFO : token expired, please log in again`);
                await this.loginUserAndGetAccessToken();
            } else {
                await this.refreshToken();
            }
        }
        const queryParams = _queryParams ? _queryParams : {};
        const headers = await this.accessTokenHeader();
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
        // const config = {
        //     headers: headers,
        //     params: params,
        // }
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
            log.error(`:: EXIT : ERROR : ${JSON.stringify(error)}`);
            return error as Error;
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
            log.error(`:: EXIT : ERROR : ${JSON.stringify(resData)}`);
            return resData;
        }
        log.debug(`:: EXIT : result data : ${JSON.stringify(resData)}`);
        return resData;
    }

    public async doPostRequest(
        url: string,
        _postData?: Record<any, any>,
        contentType?: string,
        _buildURL: boolean = false,
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
                await this.loginUserAndGetAccessToken();
            } else {
                await this.refreshToken();
            }
        }
        const postData = _postData ? _postData : {};
        const headers = await this.accessTokenHeader();
        if (!contentType) {
            headers["content-type"] = "application/json";
        } else {
            headers["content-type"] = contentType;
        }
        const params = new URLSearchParams();
        params.append('client_id', this.clientID);
        for (const [key, value] of Object.entries(postData)) {
            params.append(key, value);
        }
        const config = {
            headers: headers,
        }
        try {
            if (_buildURL) {
                url = this.buildURL(url);
            }
            const res = await axios.post(url, params, config);
            const resData: Record<any, any> = res.data;
            log.debug(`:: EXIT : ${JSON.stringify(resData)}`);
            return resData;
        } catch (error) {
            log.error(`:: EXIT : ERROR : ${JSON.stringify(error)}`);
            return error as Error;
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
            log.error(`:: EXIT : ERROR : ${JSON.stringify(resData)}`);
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