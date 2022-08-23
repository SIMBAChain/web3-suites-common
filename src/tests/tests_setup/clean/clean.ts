import {
    FileHandler,
} from "../file_handler";
import {
    SimbaConfig,
} from "../../.."

async function resetSimbaJson() {
    SimbaConfig.log.info(`resetting / cleaning up simba.json files`);
    const hardhatAZSimbaJsonPath = "../../hardhat/simba.json";
    const backupHardhatAZSimbaJsonPath = "../backup_files/backup_hardhat_az_simba.json"
    await FileHandler.transferFile(backupHardhatAZSimbaJsonPath, hardhatAZSimbaJsonPath);
}

resetSimbaJson();