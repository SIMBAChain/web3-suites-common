import {default as chalk} from 'chalk';
import {default as prompt} from "prompts";
import {SimbaConfig} from '../lib';

/**
 * add an external library to your project
 * @param libName 
 * @param libAddress 
 * @returns 
 */
export async function addLib(
    libName?: string,
    libAddress?: string,
) {
    SimbaConfig.log.debug(`:: ENTER :`);
    if (!libName || !libAddress) {
        const promptVals: prompt.PromptObject[] = [
            {
                type: 'text',
                name: 'libraryname',
                message: `Please enter the name of your library`,
            },
            {
                type: 'text',
                name: 'libraryaddress',
                message: 'Please enter the address of your library',
            },
        ];
        const chosen = await prompt(promptVals);
        if (!chosen.libraryname) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : no library name specified!`)}`);
            return;
        }
        if (!chosen.libraryaddress) {
            SimbaConfig.log.error(`${chalk.redBright(`\nsimba: EXIT : no library address specified!`)}`);
            return;
        }
        libName = chosen.libraryname as string;
        libAddress = chosen.libraryaddress as string;
    }
    const libs = SimbaConfig.ProjectConfigStore.get("library_addresses") ?
        SimbaConfig.ProjectConfigStore.get("library_addresses") :
        {} as any;
    libs[libName] = libAddress;
    SimbaConfig.ProjectConfigStore.set("library_addresses", libs);
    SimbaConfig.log.info(`${chalk.cyanBright(`\nsimba: library ${chalk.greenBright(`${libName}`)} with address ${chalk.greenBright(`${libAddress}`)} added to your library_addresses field in simba.json. You can now deploy contracts that require this libary as a dependency.`)}`);
    SimbaConfig.log.debug(`:: EXIT :`);
    return;
}

