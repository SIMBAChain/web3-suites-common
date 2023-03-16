import {default as prompt} from 'prompts';
import {
    SimbaConfig,
    discoverAndSetWeb3Suite,
    web3SuiteErrorMessage,
} from "../lib";
import {
    promisifiedReadFile,
    walkDirForContracts,
} from "./";
import * as fs from "fs";
interface Dictionary<T> {
    [Key: string]: T;
}
import {default as chalk} from 'chalk';
import axios from "axios";
import {
    authErrors,
} from "./authentication"

interface Choice {
    title: string;
    value: string;
}

interface Response {
    next: string;
    prev: string;
    data: Dictionary<any>;
}

export interface ASTAndOtherInfo {
    ast: Record<any, any>;
    source?: Record<any, any>;
    compiler?: string;
    language?: string;
    isLib?: boolean;
    contractName?: string;
    contractSourceName?: string;
}

/**
 * determines filename, whether on mac or windows machine
 * @param filePath 
 * @returns 
 */
export function WindowsOrMacFileName (filePath: string) {
    SimbaConfig.log.debug(`:: ENTER : ${filePath}`);
    const fileName = filePath.split('\\').pop()!.split('/').pop();
    SimbaConfig.log.debug(`:: EXIT : ${fileName}`);
    return fileName;
}

/**
 * used to retrieve lists of applications and organisations, mainly
 * @param config 
 * @param url 
 * @returns
 */
export const getList = async (config: SimbaConfig, url?: string): Promise<Record<any, any> | void> => {
    SimbaConfig.log.debug(`:: ENTER :`);
    if (!url) {
        url = 'v2/organisations/';
    }
    const authStore = await config.authStore();
    if (authStore) {
        try {
            const res = await authStore.doGetRequest(url);
            SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(res)}`);
            return res;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
            } else {
                SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            }
            if (axios.isAxiosError(error) && error.message === "Request failed with status code 500") {
                SimbaConfig.log.info(`${chalk.cyanBright('\nsimba: Auth token expired, please log in again')}`);
                authStore.logout();
                await authStore.loginAndGetAuthToken();
            }
        }
    } else {
        SimbaConfig.log.error(authErrors.badAuthProviderInfo)
    }
};

/**
 * choose SIMBA org from list
 * @param config 
 * @param url 
 * @returns 
 */
export const chooseOrganisationFromList = async (config: SimbaConfig, url?: string): Promise<any> => {
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(config)}`);
    if (!url) {
        url = 'v2/organisations/';
    }
    const orgResponse = await getList(config, url);

    if (!orgResponse) {
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : no organizations returned. You probably need to log in again')}`);
        return;
    }
    if (orgResponse.results) {
        SimbaConfig.log.debug(`orgResponse.results: ${JSON.stringify(orgResponse.results)}`);
    }
    if (!orgResponse.results || !orgResponse.results.length) {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: There are no organisations present. You must create an organisation to use the plugin.`)}`);
    }

    SimbaConfig.log.debug(`orgResponse.results: ${JSON.stringify(orgResponse.results)}`);

    if (!orgResponse.results || !orgResponse.results.length) {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: No organisations present`)}`);
        return;
    }

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
        choices.push({title: '-> Next Page', description: 'Next choices', value: 'next'});
    }
    
    for (const [key, val] of Object.entries(orgs.data)) {
        choices.push({title: key, value: val});
    }

    if (orgs.next) {
        choices.push({title: '-> Next Page', description: 'Next choices', value: 'next'});
    }
    
    const response = await prompt({
        type: 'select',
        name: 'organisation',
        message: 'Please pick an organisation',
        choices,
    });

    SimbaConfig.log.debug(`selected organisation: ${JSON.stringify(response.organisation)}`);

    if (response.organisation === 'prev') {
        return chooseOrganisationFromList(config, orgs.prev);
    } else if (response.organisation === 'next') {
        return chooseOrganisationFromList(config, orgs.next);
    }

    if (!response.organisation) {
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : No Organisation Selected!')}`);
        throw new Error('No Organisation Selected!');
    }
    
    config.organisation = response.organisation;
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(response.organisation)}`);
    return response.organisation;
};

/**
 * select SIMBA organisation from name
 * @param config
 * @param orgName 
 * @returns
 */
export async function chooseOrganisationFromName(
    config: SimbaConfig,
    orgName: string,
): Promise<any> {
    SimbaConfig.log.debug(`:: ENTER : ${orgName}`);
    const url = `v2/organisations/${orgName}/`;
    const authStore = await config.authStore();
    if (authStore) {
        try {
            const res = await authStore.doGetRequest(url) as Record<any, any>;
            SimbaConfig.log.info(`${chalk.cyanBright(`simba: logging in using organisation ${res.name}`)}`);
            SimbaConfig.log.debug(`:: EXIT : res : ${JSON.stringify(res)}`);
            SimbaConfig.organisation = res;
            return res;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
            } else {
                SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            }
            if (axios.isAxiosError(error) && error.message === "Request failed with status code 500") {
                SimbaConfig.log.info(`${chalk.cyanBright('\nsimba: Auth token expired, please log in again')}`);
                authStore.logout();
                await authStore.loginAndGetAuthToken();
            }
        }
    } else {
        SimbaConfig.log.error(authErrors.badAuthProviderInfo)
    }

}

/**
 * Used for Hardhat, which stores AST separately from ABI
 * @param location 
 * @returns 
 */
export function parseBuildInfoJsonName(
    location: string,
): string {
    SimbaConfig.log.debug(`:: ENTER : ${location}`);
    const fileName = WindowsOrMacFileName(location);
    SimbaConfig.log.debug(`:: EXIT : ${fileName}`);
    return fileName || location;
}

/**
 * Used for Hardhat, which stores AST separately from ABI
 * @param contractName 
 * @param contractSourceName 
 * @returns 
 */
export async function buildInfoJsonName(
    contractName: string,
    contractSourceName: string,
): Promise<string> {
    SimbaConfig.log.debug(`:: ENTER : ${contractName}`);
    const buildDir = SimbaConfig.buildDirectory;
    let files: string[] = [];
    try {
        files = await walkDirForContracts(buildDir, ".json");
    } catch (e) {
        const err = e as any;
        if (err.code === 'ENOENT') {
            SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : Simba was not able to find any build info artifacts.\nDid you forget to compile?\n')}`);
            return "";
        }
        SimbaConfig.log.error(`:: EXIT : ERROR : ${JSON.stringify(err)}`);
        return "";
    }
    for (const file of files) {
        if (!(file.endsWith(`${contractSourceName}/${contractName}.dbg.json`))
            && !(file.endsWith(`${contractSourceName}\\${contractName}.dbg.json`))) {
            continue;
        } else {
            const buf = await promisifiedReadFile(file, {flag: 'r'});
            const parsed = JSON.parse(buf.toString());
            const location = parsed.buildInfo;
            const jsonName = parseBuildInfoJsonName(location);
            SimbaConfig.log.debug(`:: EXIT : ${jsonName}`);
            return jsonName;
        }
    }
    SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : no info found for contract')}`);
    return "";
}

/**
 * Mainly used to determine if a contract is a library, contract, interface, etc.
 * @param ast 
 * @returns 
 */
export function getASTNodes(
    ast: any
): Array<Record<any, any>> {
    const astNodes = ast.nodes ? ast.nodes : [];
    return astNodes;
}

/**
 * returns type of contract (library, contract, interface)
 * @param ast 
 * @returns 
 */
export function getContractKind(
    contractName: string,
    ast: any,
): string {
    const astNodes = getASTNodes(ast);
    for (let i = 0; i < astNodes.length; i++) {
        const node = astNodes[i];
        if (node.contractKind && (node.name === contractName)) {
            const contractKind = node.contractKind;
            SimbaConfig.log.debug(`contractKind: ${contractKind}`);
            return contractKind;
        }
    }
    return "";
}

/**
 * determines if a contract is a library
 * @param ast 
 * @returns 
 */
export function isLibrary(
    contractName: string,
    ast: any,
): boolean {
    const contractKind = getContractKind(contractName, ast);
    const _isLibrary = (contractKind === "library");
    SimbaConfig.log.debug(`isLibrary: ${_isLibrary}`)
    return _isLibrary;
}

/**
 * Used for Hardhat, which stores AST separately from ABI
 * @param contractName 
 * @param contractSourceName 
 * @param _buildInfoJsonName 
 * @returns 
 */
export async function astAndOtherInfo(
    contractName: string,
    contractSourceName?: string,
    _buildInfoJsonName?: string,
): Promise<ASTAndOtherInfo> {
    const params = {
        contractName,
        contractSourceName,
        _buildInfoJsonName,
    };
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(params)}`);
    const buildInfoDir = SimbaConfig.buildInfoDirectory;
    const buildDir = SimbaConfig.buildDirectory;
    let files: string[] = [];

    let _astAndOtherInfo: ASTAndOtherInfo = {
        ast: {},
        source: {},
        compiler: "",
        language: "",
        isLib: false,
        contractName,
        contractSourceName,
    };

    const web3Suite = discoverAndSetWeb3Suite();

    if (!web3Suite) {
        throw new Error(web3SuiteErrorMessage);
    }

    if (web3Suite === "hardhat") {
        try {
            files = await walkDirForContracts(buildInfoDir, ".json");
            SimbaConfig.log.debug(`:: files : ${JSON.stringify(files)}`);
        } catch (e) {
            const err = e as any;
            if (err.code === 'ENOENT') {
                SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : Simba was not able to find any build info artifacts.\nDid you forget to compile?\n')}`);
                return _astAndOtherInfo;
            }
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(err)}`)}`);
            return _astAndOtherInfo;
        }
    }

    if (web3Suite === "truffle") {
        try {
            files = await walkDirForContracts(buildDir, ".json");
            SimbaConfig.log.debug(`:: files : ${JSON.stringify(files)}`);
        } catch (e) {
            const err = e as any;
            if (err.code === 'ENOENT') {
                SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : Simba was not able to find any build info artifacts.\nDid you forget to compile?\n')}`);
                return _astAndOtherInfo;
            }
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(err)}`)}`);
            return _astAndOtherInfo;
        }
    }
    if (web3Suite === "hardhat") {
        for (const file of files) {
            if (!(file.endsWith(_buildInfoJsonName as string))) {
                continue;
            } else {
                const buf = await promisifiedReadFile(file, {flag: 'r'});
                const parsed = JSON.parse(buf.toString());
                const output = parsed.output;
                const outputSources = output.sources;
                const outputContractSource = outputSources[contractSourceName as string];
                const ast = outputContractSource.ast;
                _astAndOtherInfo.ast = ast;
                _astAndOtherInfo.isLib = isLibrary(contractName, ast);
    
                const solcVersion = parsed.solcVersion;
                _astAndOtherInfo.compiler = solcVersion;
                const input = parsed.input;
                const language = parsed.language;
                const inputSources = input.sources;
                const inputContractSource = inputSources[contractSourceName as string];
                const contractSourceCode = inputContractSource.content;
                _astAndOtherInfo.source = contractSourceCode;
                _astAndOtherInfo.language = language;
                SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(_astAndOtherInfo)}`);
                return _astAndOtherInfo;
            }
        }
        SimbaConfig.log.error(`:: EXIT : ERROR : no contract info found for ${contractName}. please clean your build files by running 'npx hardhat clean' and then compile again with 'npx hardhat compile'`);
        return _astAndOtherInfo;
    }

    if (web3Suite === "truffle") {
        for (const file of files) {
            if (!(file.endsWith(`${contractName}.json`))) {
                continue;
            } else {
                const buf = await promisifiedReadFile(file, {flag: 'r'});
                const parsed = JSON.parse(buf.toString());
                const ast = parsed.ast;
                _astAndOtherInfo.ast = ast;
                SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(_astAndOtherInfo)}`);
                return _astAndOtherInfo;
            }
        }
        SimbaConfig.log.error(`:: EXIT : ERROR : no contract info found for ${contractName}`);
        return _astAndOtherInfo;
    }

    SimbaConfig.log.error(`:: EXIT : ERROR : no contract info found for ${contractName}`);
    return _astAndOtherInfo;

}

/**
 * Used for Hardhat, which stores AST separately from ABI
 * @param contractName 
 * @param contractSourceName 
 * @returns 
 */
export async function getASTAndOtherInfo(
    contractName: string,
    contractSourceName?: string,
): Promise<ASTAndOtherInfo | Error> {
    const entryParams = {
        contractName,
        contractSourceName,
    }
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);
    let _buildInfoJsonName;
    const web3Suite = discoverAndSetWeb3Suite();
    if (!web3Suite) {
        throw new Error(web3SuiteErrorMessage);
    }
    if (web3Suite === "hardhat") {
        _buildInfoJsonName = await buildInfoJsonName(contractName, contractSourceName as string);
    }
    const _astAndOtherInfo = await astAndOtherInfo(
        contractName,
        contractSourceName,
        _buildInfoJsonName,
    );
    if (Object.keys(_astAndOtherInfo.ast).length === 0) {
        const message = `no ast found for ${contractName}`;
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
        throw new Error(`${message}`);
    }
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(_astAndOtherInfo)}`);
    return _astAndOtherInfo;
}

/**
 * Used for Hardhat, which stores AST separately from ABI
 * This actually writes the AST to the build file containing the ABI
 * @param contractName 
 * @param contractSourceName 
 * @returns 
 */
export async function writeAndReturnASTAndOtherInfo(
    contractName: string,
    contractSourceName: string,
): Promise<ASTAndOtherInfo> {
    const entryParams = {
        contractName,
        contractSourceName,
    };
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);
    const _astAndOtherInfo = await getASTAndOtherInfo(
        contractName,
        contractSourceName,
        ) as ASTAndOtherInfo;
    const buildDir = SimbaConfig.buildDirectory;
    const files = await walkDirForContracts(buildDir, ".json");
    for (const file of files) {
        if (!(file.endsWith(`/${contractName}.json`))) {
            continue;
        }
        const buf = await promisifiedReadFile(file, {flag: 'r'});
        const parsed = JSON.parse(buf.toString());
        parsed.ast = _astAndOtherInfo.ast;
        parsed.source = _astAndOtherInfo.source;
        const data = JSON.stringify(parsed);
        SimbaConfig.log.debug(`:: writing to ${file}`);
        fs.writeFileSync(file, data);
        SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(_astAndOtherInfo)}`);
        return _astAndOtherInfo;
    }
    return _astAndOtherInfo;
}

/**
 * Used for Hardhat, which stores AST separately from ABI
 * @returns 
 */
export async function getABIForPrimaryContract() {
    SimbaConfig.log.debug(`:: ENTER :`);
    const contractName = SimbaConfig.ProjectConfigStore.get("primary");
    if (!contractName) {
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : no primary contract in simba.json')}`);
        return "";
    }
    const buildDir = SimbaConfig.buildDirectory;
    SimbaConfig.log.debug(`buildDir: ${buildDir}`);
    const files = await walkDirForContracts(buildDir, ".json");
    for (const file of files) {
        SimbaConfig.log.debug(`:: file : ${JSON.stringify(file)}`);
        const fileName = WindowsOrMacFileName(file);
        if (fileName !== `${contractName}.json`) {
            continue;
        }
        const buf = await promisifiedReadFile(file, {flag: 'r'});
        const parsed = JSON.parse(buf.toString());
        const abi = parsed.abi;
        SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(abi)}`);
        return abi;
    }
    SimbaConfig.log.debug(`:: no abi found for contract ${contractName}`);
    SimbaConfig.log.debug(`:: EXIT :`);
    return;
}

/**
 * choose SIMBA application from application name
 * @param config 
 * @param id 
 * @returns 
 */
export async function chooseApplicationFromName(
    config: SimbaConfig,
    appName: string,
): Promise<any> {
    SimbaConfig.log.debug(`:: ENTER : ${appName}`);
    const url = `v2/organisations/${config.organisation.id}/applications/${appName}/`;
    const authStore = await config.authStore();
    if (authStore) {
        try {
            const res = await authStore.doGetRequest(url, 'application/json') as Record<any, any>;
            SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(res)}`);
            SimbaConfig.log.info(`${chalk.cyanBright(`simba: logging in using app ${res.name}`)}`);
            SimbaConfig.application = res;
            return res;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
            } else {
                SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            }
            if (axios.isAxiosError(error) && error.message === "Request failed with status code 500") {
                SimbaConfig.log.info(`${chalk.cyanBright('\nsimba: Auth token expired, please log in again')}`);
                authStore.logout();
                await authStore.loginAndGetAuthToken();
            }
        }
    } else {
        SimbaConfig.log.error(authErrors.badAuthProviderInfo);
    }
};

/**
 * select a name for a new SIMBA app
 * @param config
 * @returns
**/
export async function selectNewApplicationName(
    config: SimbaConfig,
): Promise<any> {
    const appName = await prompt({
        type: 'text',
        name: 'app_name',
        message: 'Please enter the name of your app', 
    });
    if (!appName.app_name) {
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : no application name specified!')}`);
        return
    }
    
    const authStore = await config.authStore();
    const url = `v2/organisations/${config.organisation.id}/applications/validate/${appName.app_name}/`;
    if (authStore) {
        try {
            const appNameResponse = await authStore.doGetRequest(url, 'application/json');
            return appName.app_name;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                if (error.response.data.errors[0].code == 1400) {
                    SimbaConfig.log.error(`\nsimba: Invalid app name: ${error.response.data.errors[0].detail}`);
                    return await selectNewApplicationName(config);
                } else {
                    SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
                }
            } else {
                SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            }
            if (axios.isAxiosError(error) && error.message === "Request failed with status code 500") {
                SimbaConfig.log.info(`${chalk.cyanBright('\nsimba: Auth token expired, please log in again')}`);
                authStore.logout();
                await authStore.loginAndGetAuthToken();
                return await selectNewApplicationName(config);
            }
        }
    } else {
        SimbaConfig.log.error(authErrors.badAuthProviderInfo);
    }
};


/**
 * create SIMBA app
 * @param config
 * @returns
**/
async function createApplicationForOrg(
    config: SimbaConfig,
): Promise<any> {
    const authStore = await config.authStore();
    const url = `v2/organisations/${config.organisation.id}/applications/`;
    const appName = await selectNewApplicationName(config);
    const postData = {
        name: appName,
        display_name: appName,
    }

    if (authStore) {
        try {
            return await authStore.doPostRequest(url, postData, 'application/json');
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`)
            } else {
                SimbaConfig.log.debug(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            }
            if (axios.isAxiosError(error) && error.message === "Request failed with status code 500") {
                SimbaConfig.log.info(`${chalk.cyanBright('\nsimba: Auth token expired, please log in again')}`);
                authStore.logout();
                await authStore.loginAndGetAuthToken();
                return await createApplicationForOrg(config);
            }
        }
    } else {
        SimbaConfig.log.error(authErrors.badAuthProviderInfo);
    }
};

/**
 * choose SIMBA app from list
 * @param config 
 * @param url 
 * @returns 
 */
export async function chooseApplicationFromList(
    config: SimbaConfig,
    url?: string,
): Promise<any> {
    const entryParams = {
        config,
        url,
    };
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);
    if (!url) {
        url = `v2/organisations/${config.organisation.id}/applications/`;
    }

    const appResponse = await getList(config, url);

    SimbaConfig.log.debug(`appResponse: ${JSON.stringify(appResponse)}`);
    
    if (!appResponse) {
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : no applications in list. You probably need to login again.')}`);
        return;
    }
    if (appResponse.results) {
        SimbaConfig.log.debug(`appResponse.results: ${JSON.stringify(appResponse.results)}`);
    }
    if (!appResponse.results || !appResponse.results.length) {
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: Your organisation does not have any apps. Please create one:`)}`);
        return await createApplicationForOrg(config);
    }

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
        choices.push({title: '-> Next Page', description: 'Next choices', value: 'next'});
    }

    for (const [key, val] of Object.entries(apps.data)) {
        choices.push({title: key, value: val});
    }

    if (apps.next) {
        choices.push({title: '-> Next Page', description: 'Next choices', value: 'next'});
    }

    const response = await prompt({
        type: 'select',
        name: 'application',
        message: 'Please pick an application',
        choices,
    });

    SimbaConfig.log.debug(`selected application: ${JSON.stringify(response.application)}`);

    if (response.application === 'prev') {
        return chooseApplicationFromList(config, apps.prev);
    } else if (response.application === 'next') {
        return chooseApplicationFromList(config, apps.next);
    }

    if (!response.application) {
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : No Application Selected!')}`);
        throw new Error('No Application Selected!');
    }
    config.application = response.application;
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(response.application)}`);
    return response.application;
};

/**
 * fetch available blockchains
 * @param config 
 * @param url 
 * @returns 
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getBlockchains(
    config: SimbaConfig,
    url?: string,
): Promise<any> {
    const entryParams = {
        config,
        url,
    };
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);
    if (!url) {
        url = `v2/organisations/${config.organisation.id}/blockchains/`;
    }

    const chains: any = await getList(config, url);
    const choices: Choice[] = [];

    chains.results.forEach((chain: any) => {
        choices.push({
            title: chain.display_name,
            value: chain.name,
        });
    });
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(choices)}`);
    return choices;
};

/**
 * fetch available storages
 * @param config 
 * @param url 
 * @returns 
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getStorages(
    config: SimbaConfig,
    url?: string,
): Promise<any> {
    const entryParams = {
        config,
        url,
    };
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);
    if (!url) {
        url = `v2/organisations/${config.organisation.id}/storage/`;
    }

    const storages: any = await getList(config, url);
    const choices: Choice[] = [];

    storages.results.forEach((storage: any) => {
        choices.push({
            title: storage.display_name,
            value: storage.name,
        });
    });
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(choices)}`);
    return choices;
};

/**
 * gets field from primary contract (in simba.json) ABI
 * @param name 
 * @returns 
 */
export async function getFieldFromPrimaryContractABI(
    name: string,
) {
    SimbaConfig.log.debug(`:: ENTER : ${name}`);
    const abi = await getABIForPrimaryContract();
    for (let i = 0; i < abi.length; i++) {
        const entry = abi[i];
        if (entry.name === name) {
            SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(entry)}`);
            return entry;
        }
    }
    SimbaConfig.log.debug(`:: EXIT : {}`);
    return {};
}

/**
 * get constructor for primary contract
 * @returns 
 */
export async function primaryContractConstructor() {
    SimbaConfig.log.debug(`:: ENTER :`);
    const abi = await getABIForPrimaryContract();
    SimbaConfig.log.debug(`:: abi for primary contract: ${JSON.stringify(abi)}`);
    for (let i = 0; i < abi.length; i++) {
        const entry = abi[i];
        if (entry.type === "constructor") {
            SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(entry)}`);
            return entry;
        }
    }
    SimbaConfig.log.debug(`:: EXIT : {}`);
    return {};
}

/**
 * aids in specifying types when asking user to input values
 * @returns 
 */
export async function primaryConstructorInputs() {
    SimbaConfig.log.debug(`:: ENTER :`);
    const constructor = await primaryContractConstructor();
    const constructorInputs = constructor.inputs ? constructor.inputs : [];
    const inputs = [];
    for (let i = 0; i < constructorInputs.length; i++) {
        const input = constructorInputs[i];
        const type = input.type;
        const name = input.name;
        inputs.push({
            type,
            name,
        });
    }
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(inputs)}`);
    return inputs;
}

/**
 * tells us whether a contract's constructor has params
 * We use this function so we know whether to prompt the
 * user to specify the method they want to use to provide param values
 * @returns 
 */
export async function primaryConstructorRequiresArgs(): Promise<boolean> {
    SimbaConfig.log.debug(`:: ENTER :`);
    const constructor = await primaryContractConstructor();
    const inputs = constructor.inputs;
    let requiresArgs = false;
    if (inputs && inputs.length > 0) {
        requiresArgs = true;
    }
    SimbaConfig.log.debug(`:: EXIT : ${requiresArgs}`);
    return requiresArgs;
}
