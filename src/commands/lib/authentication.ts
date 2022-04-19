import axios from "axios";
import {
    Logger,
} from "tslog";
import { URLSearchParams } from "url";
const log: Logger = new Logger();
// import * as dotenv from "dotenv";
// dotenv.config({ path: __dirname+'/.env' });

const CLIENT_ID = "simba-pkce";
const CLIENT_URL = "https://simba-dev-sso.platform.simbachain.com";
const REALM = "simbachain";

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
    refresh_expires_in: number;
    refresh_token: string;
    token_type: string;
    not_before_policy: number;
    session_state: string;
    scope: string;
}

class KeycloakDeviceLoginHandler {
    clientID: string;
    clientURL: string;
    realm: string;
    verificationInfo: KeycloakDeviceVerificationInfo;
    constructor(
        clientID: string = CLIENT_ID,
        clientURL: string = CLIENT_URL,
        realm: string = REALM,
    ) {
        this.clientID = clientID;
        this.clientURL = clientURL;
        this.realm = realm;
    }

    private async getVerificationInfo(): Promise<KeycloakDeviceVerificationInfo> {
        log.debug(`:: ENTER :`);
        const url = `${this.clientURL}/auth/realms/${this.realm}/protocol/openid-connect/auth/device`;
        const params = new URLSearchParams();
        params.append('client_id', this.clientID);
        const headers = {
            'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
        };
        const config = {
            headers: headers,
        }
        const res = await axios.post(url, params, config);
        const verificationInfo: KeycloakDeviceVerificationInfo = res.data;
        log.debug(`:: EXIT : ${JSON.stringify(verificationInfo)}`);
        return verificationInfo;
    }

    public async loginUser(): Promise<void> {
        log.debug(`:: ENTER :`);
        if (!this.verificationInfo) {
            this.verificationInfo = await this.getVerificationInfo();
        }
        const verificationURI = this.verificationInfo.verification_uri;
        const userCode = this.verificationInfo.user_code;
        console.log(`\nYour user_code is ${userCode}\n\nIn your browser, please navigate to the following URL and enter your user_code: ${verificationURI}`);
        log.debug(`:: EXIT :`);
    }

    public async getAccessToken(): Promise<KeycloakAccessToken> {
        log.debug(`:: ENTER :`);
        if (!this.verificationInfo) {
            this.verificationInfo = await this.getVerificationInfo();
        }
        const deviceCode = this.verificationInfo.device_code;
        const params = new URLSearchParams();
        const url = `${this.clientURL}/auth/realms/${this.realm}/protocol/openid-connect/token`;
        const headers = {
            'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
        };
        const config = {
            headers: headers,
        }
        params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
        params.append("client_id", this.clientID);
        params.append("device_code", deviceCode);
        const accessToken: KeycloakAccessToken = await axios.post(url, params, config);
        log.debug(`:: EXIT : ${accessToken}`);
        return accessToken;
    }
}

async function main() {
    const kcdh = new KeycloakDeviceLoginHandler();
    await kcdh.loginUser();
    // await kcdh.getAccessToken();
}

main();