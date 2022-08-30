import {
    FileHandler,
} from "../file_handler";
import {
    SimbaConfig,
} from "../../.."
import * as path from 'path';
import {cwd} from 'process';

async function resetSimbaJson() {
    SimbaConfig.log.info(`resetting / building simba.json files`);
    const hardhatAZSimbaJsonPath = "../../hardhat/simba.json";
    const backupHardhatAZSimbaJsonPath = "../backup_files/backup_hardhat_az_simba.json"
    await FileHandler.transferFile(backupHardhatAZSimbaJsonPath, hardhatAZSimbaJsonPath);

    const truffleKCSimbaJsonPath = "../../truffle/simba.json";
    const backupTruffleAZSimbaJsonPath = "../backup_files/backup_truffle_kc_simba.json"
    await FileHandler.transferFile(backupTruffleAZSimbaJsonPath, truffleKCSimbaJsonPath);
}

async function resetHardhatArtifacts() {
    SimbaConfig.log.info(`resetting hardhat artifacts`);
    const contractSolName = "TestContractVT20.sol";
    const contractJsonName = "TestContractVT20.json";
    let pathToContractBuildFile = path.join("../../hardhat/", "artifacts", "contracts", contractSolName, contractJsonName);

    let pathToBackUpBuildArtifact = path.join(cwd(), "../", "backup_files", "backup_hardhat_artifacts", "artifacts", "contracts", contractSolName, contractJsonName);
    await FileHandler.transferFile(pathToBackUpBuildArtifact, pathToContractBuildFile);
}

resetSimbaJson();
resetHardhatArtifacts();