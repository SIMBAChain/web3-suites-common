import {
    SimbaConfig,
} from "../commands/lib/config";
import {
    AzureHandler,
} from "../commands/lib/authentication";
import {
    pullContractsInteractive,
    pullAllMostRecentContracts,
    pullAllMostRecentSolFilesAndSourceCode,
    pullMostRecentRecentSolFileFromContractName,
    pullMostRecentFromContractName
} from "../commands/contract";
import {
    printAllContracts,
} from "../commands/contract/list"

async function main() {
    const simbaConfig = new SimbaConfig();
    const authStore = await simbaConfig.authStore();
    
    // // const res = await syncContracts("asdfasdf");
    // // const res = await syncContract("cb3ad592-1ca2-43b3-a9d0-cd0d0f127b32");
    // const res = await syncContract();
    // // await printAllContracts();
    // const org = "brendan_birch_simbachain_com";
    // const app = "BrendanTestApp";
    if (authStore instanceof AzureHandler) {
        await authStore.performLogin(false);
    }
    // await pullContractsInteractive();
    await pullAllMostRecentSolFilesAndSourceCode(
        true,
        true,
    );
    await pullMostRecentFromContractName("TestContract");

}

// main();