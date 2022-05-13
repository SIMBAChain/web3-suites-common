import {default as prompt} from 'prompts';
import {
    SimbaConfig,
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

interface Choice {
    title: string;
    value: string;
}

interface Response {
    next: string;
    prev: string;
    data: Dictionary<any>;
}

interface ASTAndOtherInfo {
    ast: Record<any, any>;
    source: Record<any, any>;
    compiler: string;
    language: string;
    isLib: boolean;
    contractName: string;
    contractSourceName: string;
}

const getList = async (config: SimbaConfig, url?: string): Promise<Record<any, any> | void> => {
    SimbaConfig.log.debug(`:: ENTER :`);
    if (!url) {
        url = 'v2/organisations/';
    }
    try {
        const res = config.authStore.doGetRequest(url);
        SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(res)}`);
        return res;
    } catch (e) {
        const err = e as any;
        if (err.message === "Request failed with status code 500") {
            SimbaConfig.log.info(`${chalk.cyanBright('\nsimba: Auth token expired, please log in again')}`);
            SimbaConfig.authStore.logout();
            await SimbaConfig.authStore.loginAndGetAuthToken();
        }
    }
};

export const chooseOrganisationFromList = async (config: SimbaConfig, url?: string): Promise<any> => {
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(config)}`);
    if (!url) {
        url = 'organisations/';
    }
    const orgResponse = await getList(config, url);

    if (!orgResponse) {
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : no organizations returned. You probably need to log in again')}`);
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
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : No Organisation Selected!')}`);
        throw new Error('No Organisation Selected!');
    }
    
    config.organisation = response.organisation;
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(response.organisation)}`);
    return response.organisation;
};

export async function chooseOrganisationFromInput(
    config: SimbaConfig,
    url?: string,
): Promise<any> {
    console.error("needs to be implemented");
}

function parseBuildInfoJsonName(
    location: string,
): string {
    SimbaConfig.log.debug(`:: ENTER : ${location}`);
    if (location.includes("/")) {
        const idArr = location.split("/");
        const jsonName = idArr[idArr.length-1];
        SimbaConfig.log.debug(`:: EXIT : ${jsonName}`);
        return jsonName;
    } else {
        SimbaConfig.log.debug(`:: EXIT : ${location}`);
        return location;
    }
}

async function buildInfoJsonName(
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
            SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : Simba was not able to find any build info artifacts.\nDid you forget to run: "npx hardhat compile" ?\n')}`);
            return "";
        }
        SimbaConfig.log.error(`:: EXIT : ERROR : ${JSON.stringify(err)}`);
        return "";
    }
    for (const file of files) {
        if (!(file.endsWith(`${contractSourceName}/${contractName}.dbg.json`))) {
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

function getASTNodes(
    ast: any
): Array<Record<any, any>> {
    const astNodes = ast.nodes ? ast.nodes : [];
    return astNodes;
}

function getContractKind(
    ast: any,
): string {
    const astNodes = getASTNodes(ast);
    for (let i = 0; i < astNodes.length; i++) {
        const node = astNodes[i];
        if (node.contractKind) {
            const contractKind = node.contractKind;
            SimbaConfig.log.info(`contractKind: ${contractKind}`);
            return contractKind;
        }
    }
    return "";
}

export function isLibrary(
    ast: any,
): boolean {
    const contractKind = getContractKind(ast);
    const _isLibrary = (contractKind === "library");
    SimbaConfig.log.info(`isLibrary: ${_isLibrary}`)
    return _isLibrary;
}

async function astAndOtherInfo(
    contractName: string,
    contractSourceName: string,
    _buildInfoJsonName: string,
): Promise<ASTAndOtherInfo> {
    const params = {
        contractName,
        _buildInfoJsonName,
    };
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(params)}`);
    const buildInfoDir = SimbaConfig.buildInfoDirectory;
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

    try {
        files = await walkDirForContracts(buildInfoDir, ".json");
        SimbaConfig.log.debug(`:: files : ${JSON.stringify(files)}`);
    } catch (e) {
        const err = e as any;
        if (err.code === 'ENOENT') {
            SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : Simba was not able to find any build info artifacts.\nDid you forget to run: "npx hardhat compile" ?\n')}`);
            return _astAndOtherInfo;
        }
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(err)}`)}`);
        return _astAndOtherInfo;
    }

    for (const file of files) {
        if (!(file.endsWith(_buildInfoJsonName))) {
            continue;
        } else {
            const buf = await promisifiedReadFile(file, {flag: 'r'});
            const parsed = JSON.parse(buf.toString());
            const output = parsed.output;
            const outputSources = output.sources;
            const outputContractSource = outputSources[contractSourceName];
            const ast = outputContractSource.ast;
            _astAndOtherInfo.ast = ast;
            _astAndOtherInfo.isLib = isLibrary(ast);

            const solcVersion = parsed.solcVersion;
            _astAndOtherInfo.compiler = solcVersion;

            const input = parsed.input;
            const language = parsed.language;
            const inputSources = input.sources;
            const inputContractSource = inputSources[contractSourceName];
            const contractSourceCode = inputContractSource.content;
            _astAndOtherInfo.source = contractSourceCode;
            _astAndOtherInfo.language = language;
            SimbaConfig.log.info(`:: EXIT : ${JSON.stringify(_astAndOtherInfo)}`);
            return _astAndOtherInfo;
        }
    }
    SimbaConfig.log.error(`:: EXIT : ERROR : no contract info found`);
    return _astAndOtherInfo;
}

export async function getASTAndOtherInfo(
    contractName: string,
    contractSourceName: string,
): Promise<ASTAndOtherInfo | Error> {
    const entryParams = {
        contractName,
        contractSourceName,
    }
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(entryParams)}`);
    const _buildInfoJsonName = await buildInfoJsonName(contractName, contractSourceName);
    const _astAndOtherInfo = await astAndOtherInfo(
        contractName,
        contractSourceName,
        _buildInfoJsonName,
    );
    if (_astAndOtherInfo.ast === {}) {
        const message = `no ast found for ${contractName}`;
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${message}`)}`);
        return new Error(`${message}`);
    }
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(_astAndOtherInfo)}`);
    return _astAndOtherInfo;
}

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
    const sourceFileName = contractSourceName.split("/")[1];
    const filePath = `${buildDir}/${sourceFileName}/${contractName}.json`;
    const files = await walkDirForContracts(buildDir, ".json");
    for (const file of files) {
        if (!(file.endsWith(`${contractName}.json`))) {
            continue;
        }
        const buf = await promisifiedReadFile(file, {flag: 'r'});
        const parsed = JSON.parse(buf.toString());
        parsed.ast = _astAndOtherInfo.ast;
        parsed.source = _astAndOtherInfo.source;
        const data = JSON.stringify(parsed);
        SimbaConfig.log.debug(`:: writing to ${filePath}`);
        fs.writeFileSync(filePath, data);
        SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(_astAndOtherInfo)}`);
        return _astAndOtherInfo;
    }
    return _astAndOtherInfo;
}

export async function getApp(config: SimbaConfig,
    id: string,
): Promise<any> {
    SimbaConfig.log.debug(`:: ENTER : ${id}`);
    const url = `organisations/${config.organisation.id}/applications/${id}`;
    const response = await config.authStore.doGetRequest(url, 'application/json');
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(response)}`);
    return response;
};

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
        url = `organisations/${config.organisation.id}/applications/`;
    }

    const appResponse = await getList(config, url);

    if (!appResponse) {
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : no applications in list. You probably need to login again.')}`);
        return;
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
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : No Application Selected!')}`);
        throw new Error('No Application Selected!');
    }
    config.application = response.application;
    SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(response.application)}`);
    return response.application;
};

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
        url = `organisations/${config.organisation.id}/blockchains/`;
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
        url = `organisations/${config.organisation.id}/storage/`;
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

// the following code is for merging AST for a contract into build artifact for that contract
async function getABIForPrimaryContract(
) {
    SimbaConfig.log.debug(`:: ENTER :`);
    const contractName = SimbaConfig.ProjectConfigStore.get("primary");
    if (!contractName) {
        SimbaConfig.log.error(`${chalk.redBright('\nsimba: EXIT : no primary contract in simba.json')}`);
        return "";
    }
    const buildDir = SimbaConfig.buildDirectory;
    const files = await walkDirForContracts(buildDir, ".json");
    for (const file of files) {
        if (!(file.endsWith(`${contractName}.json`))) {
            continue;
        }
        const buf = await promisifiedReadFile(file, {flag: 'r'});
        const parsed = JSON.parse(buf.toString());
        const abi = parsed.abi;
        SimbaConfig.log.debug(`:: EXIT : ${JSON.stringify(abi)}`);
        return abi;
    }
}

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

async function primaryContractConstructor() {
    SimbaConfig.log.debug(`:: ENTER :`);
    const abi = await getABIForPrimaryContract();
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