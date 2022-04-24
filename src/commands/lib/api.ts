import {
    Logger,
} from "tslog";
const log: Logger = new Logger();
import {default as prompt} from 'prompts';
import {
    SimbaConfig,
} from "../lib";

interface Dictionary<T> {
    [Key: string]: T;
}

interface Choice {
    title: string;
    value: string;
}

interface Response {
    next: string;
    prev: string;
    data: Dictionary<any>;
}

const getList = async (config: SimbaConfig, url?: string): Promise<any> => {
    if (!url) {
        url = 'v2/organisations/';
    }
    return config.authStore.doGetRequest(url);
};

export const chooseOrganisationFromList = async (config: SimbaConfig, url?: string): Promise<any> => {
    log.debug(`:: ENTER : ${JSON.stringify(config)}`);
    if (!url) {
        url = 'organisations/';
    }
    log.debug(`:: url : ${url}`);
    const orgResponse = await getList(config, url);

    const orgs: Response = {
        next: orgResponse.next,
        prev: orgResponse.prev,
        data: orgResponse.results.reduce((map: Dictionary<object>, obj: any) => {
            const data = {...obj, id: obj.id};
            map[data.name] = data;
            return map;
        }, {}),
    };

    const choices = [];
    if (orgs.prev) {
        choices.push({
            title: '<-',
            description: 'Previous choices',
            value: 'prev'
        });
    }

    if (orgs.next) {
        choices.push({title: '->', description: 'Next choices', value: 'next'});
    }

    for (const [key, val] of Object.entries(orgs.data)) {
        choices.push({title: key, value: val});
    }

    const response = await prompt({
        type: 'select',
        name: 'organisation',
        message: 'Please pick an organisation',
        choices,
    });

    if (response.organisation === 'prev') {
        return chooseOrganisationFromList(config, orgs.prev);
    } else if (response.organisation === 'next') {
        return chooseOrganisationFromList(config, orgs.next);
    }

    if (!response.organisation) {
        throw new Error('No Organisation Selected!');
    }
    
    config.setOrganisation(response.organisation);

    return response.organisation;
};

export const chooseOrganisationFromInput = async (config: SimbaConfig, url?: string): Promise<any> => {
    console.error("needs to be implemented");
}

export const getApp = async (config: SimbaConfig, id: string): Promise<any> => {
    const url = `organisations/${config.organisation.id}/applications/${id}`;
    const response = await config.authStore.doGetRequest(url, 'application/json');
    return response;
};

export const chooseApplicationFromList = async (config: SimbaConfig, url?: string): Promise<any> => {
    if (!url) {
        url = `organisations/${config.organisation.id}/applications/`;
    }

    const appResponse = await getList(config, url);

    const apps: Response = {
        next: appResponse.next,
        prev: appResponse.prev,
        data: appResponse.results.reduce((map: Dictionary<object>, obj: any) => {
            const data = {...obj, id: obj.id};
            map[data.display_name] = data;
            return map;
        }, {}),
    };

    const choices = [];
    if (apps.prev) {
        choices.push({
            title: '<-',
            description: 'Previous choices',
            value: 'prev'
        });
    }

    if (apps.next) {
        choices.push({title: '->', description: 'Next choices', value: 'next'});
    }

    for (const [key, val] of Object.entries(apps.data)) {
        choices.push({title: key, value: val});
    }

    const response = await prompt({
        type: 'select',
        name: 'application',
        message: 'Please pick an application',
        choices,
    });

    if (response.application === 'prev') {
        return chooseApplicationFromList(config, apps.prev);
    } else if (response.application === 'next') {
        return chooseApplicationFromList(config, apps.next);
    }

    if (!response.application) {
        throw new Error('No Application Selected!');
    }
    config.setApplication(response.application);

    return response.application;
};