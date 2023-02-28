import {default as chalk} from 'chalk';
import {default as prompt} from 'prompts';
import {
    SimbaConfig,
} from '../lib';
import {buildURL} from "../lib"; 
import {ContractDesignWithCode} from '.';
import axios from "axios";
import {
    allContracts,
} from "./list";

/**
 * deletes contract from your organisation's design patterns, based on designID
 * @param designID 
 * @returns 
 */
export async function deleteContractFromDesignID(
    designID: string,
): Promise<void> {
    SimbaConfig.log.debug(`:: ENTER : designID : ${designID}`);
    const authStore = await SimbaConfig.authStore();
    if (!authStore) {
        SimbaConfig.log.error(`${chalk.redBright(`\nsimba: no authStore instantiated`)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
        return;
    };
    const deleteEndpoint = `/v2/organisations/${SimbaConfig.organisation.id}/contract_designs/${designID}/`;
    let baseURL = SimbaConfig.retrieveBaseAPIURL();
    let url;
    if (baseURL) {
        url = buildURL(baseURL, deleteEndpoint);
    } else {
        const message = "unable to obtain value for baseURL/SIMBA_API_BASE_URL";
        SimbaConfig.log.error(`:: EXIT : ${message}`)
        throw new Error(message);
    }
    SimbaConfig.log.debug(`url : ${url}`);
    try {
        await authStore.doDeleteRequest(url);
        const orgName = SimbaConfig.ProjectConfigStore.get("organisation").name;
        SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: contract with design_id ${chalk.greenBright(`${designID}`)} successfully deleted from org ${chalk.greenBright(`${orgName}`)}`)}`);
        SimbaConfig.log.debug(`:: EXIT :`);
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.data.errors[0].status === "404") {
                SimbaConfig.log.error(`${chalk.redBright(` \nsimba: designID ${chalk.greenBright(`${designID}`)} not found. Please make sure you're using the correct designID param`)}`);
            }
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`);
            return;
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            return;
        }
    }
}

/**
 * Allows user to delete contracts from org from prompts
 * @param contractDesignArray 
 * @returns 
 */
export async function deleteContractsFromPrompts(contractDesignArray?: ContractDesignWithCode[]): Promise<any> {
    SimbaConfig.log.debug(`:: ENTER : contractDesignArary: ${JSON.stringify(contractDesignArray)}`);
    try {
        const contractDesigns = contractDesignArray ?
            contractDesignArray :
            await allContracts();
        const choices = [];
        if (contractDesigns) {
            for (let i = 0; i < contractDesigns.length; i++) {
                const title = `${chalk.green(contractDesigns[i].name)} :: ${chalk.green("id")} ${
                    contractDesigns[i].id} :: ${chalk.green("created_on")} ${contractDesigns[i].created_on} :: ${chalk.green("updated_on")} ${contractDesigns[i].updated_on}`;
                const value = contractDesigns[i];
                choices.push({title: title, value: value});
            }
        } else {
            SimbaConfig.log.error(`\nsimba: error obtaining contracts`);
            return;
        }
        const chosen = await prompt({
            type: 'multiselect',
            name: 'contracts',
            message: `${chalk.cyanBright(`Please select all contracts you want to delete from your organisation. Use the Space Bar to select or un-select a contract (You can also use -> to select a contract, and <- to un-select a contract). Hit Return/Enter when you are ready to sync your contracts. THIS WILL PERMANENTLY DELETE THESE CONTRACT DESIGNS FROM YOUR SIMBA ORGANISATION.`)}`,
            choices,
        });
        for (let i = 0; i < chosen.contracts.length; i++) {
            const contractDesign = chosen.contracts[i];
            await deleteContractFromDesignID(contractDesign.id);
        }
        return;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error.response.data)}`)}`);
            return;
        } else {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : ${JSON.stringify(error)}`)}`);
            return;
        }
    }
}
