import {
    FileHandler,
} from "../file_handler";
import {
    SimbaConfig,
} from "../../.."

async function resetSimbaJson() {
    SimbaConfig.log.info(`resetting / building simba.json files`);
    const hardhatAZSimbaJsonPath = "../../hardhat/simba.json";
    const backupHardhatAZSimbaJsonPath = "../backup_files/backup_hardhat_az_simba.json"
    await FileHandler.transferFile(backupHardhatAZSimbaJsonPath, hardhatAZSimbaJsonPath);

    const truffleKCSimbaJsonPath = "../../truffle/simba.json";
    const backupTruffleAZSimbaJsonPath = "../backup_files/backup_truffle_kc_simba.json"
    await FileHandler.transferFile(backupTruffleAZSimbaJsonPath, truffleKCSimbaJsonPath);
}

resetSimbaJson();