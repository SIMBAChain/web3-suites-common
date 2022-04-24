import {cwd} from 'process';
import * as path from 'path';
import Configstore from 'configstore';
import {KeycloakHandler} from './authentication';

export class SimbaConfig {
    public web3Suite: string;
    // Common config, such as auth
    public configStore: Configstore;
    // Project config, such as app ID, etc
    public projectConfigStore: Configstore;
    public help = false;
    public authStore: KeycloakHandler;
    public application: any;
    public organisation: any;

    public constructor(
        web3Suite: string,
    ) {
        this.web3Suite = web3Suite;
        this.configStore = new Configstore(`@simbachain/${this.web3Suite}`);
        this.projectConfigStore = new Configstore(`@simbachain/${this.web3Suite}`, null, {
            configPath: path.join(cwd(), 'simba.json'),
        });
        this.application = this.getApplication();
        this.organisation = this.getOrganisation();
        this.authStore = this.getAuthStore();
        console.log("path to simba.json: ", this.projectConfigStore.path);
    }

    public getConfigStore(): Configstore {
        if (!this.configStore) {
            this.configStore = new Configstore(`@simbachain/${this.web3Suite}`);
        }
        return this.configStore;
    }

    public getProjectConfigStore(): Configstore {
        if (!this.projectConfigStore) {
            this.projectConfigStore = new Configstore(`@simbachain/${this.web3Suite}`, null, {
                configPath: path.join(cwd(), 'simba.json'),
            });
        }
        return this.projectConfigStore;
    }

    public getAuthStore(): KeycloakHandler {
        if (!this.authStore) {
            this.authStore = new KeycloakHandler(this.configStore, this.projectConfigStore);
        }
        return this.authStore;
    }

    public getWeb3Suite(): string {
        return this.projectConfigStore.get('web3Suite');
    }

    public setWeb3Sute(web3Suite: string) {
        this.projectConfigStore.set('web3Suite', web3Suite);
    }

    public getOrganisation(): string {
        const org = this.projectConfigStore.get('organisation') ? this.projectConfigStore.get('organisation') : this.projectConfigStore.get('organization');
        return org;
    }

    public setOrganisation(org: string) {
        this.projectConfigStore.set('organisation', org);
    }

    public getApplication(): string {
        return this.projectConfigStore.get('application');
    }

    public setApplication(org: string) {
        this.projectConfigStore.set('application', org);
    }
}