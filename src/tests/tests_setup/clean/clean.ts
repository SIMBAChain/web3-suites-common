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
    let pathToContractBuildFile = path.join("../../hardhat/", "artifacts");
    pathToContractBuildFile = path.join(pathToContractBuildFile, "contracts");
    pathToContractBuildFile = path.join(pathToContractBuildFile, contractSolName);
    pathToContractBuildFile = path.join(pathToContractBuildFile, contractJsonName);

    let pathToBackUpBuildArtifact = path.join(cwd(), "../");
    pathToBackUpBuildArtifact = path.join(pathToBackUpBuildArtifact, "backup_files");
    pathToBackUpBuildArtifact = path.join(pathToBackUpBuildArtifact, "backup_hardhat_artifacts");
    pathToBackUpBuildArtifact = path.join(pathToBackUpBuildArtifact, "artifacts");
    pathToBackUpBuildArtifact = path.join(pathToBackUpBuildArtifact, "contracts");
    pathToBackUpBuildArtifact = path.join(pathToBackUpBuildArtifact, contractSolName);
    pathToBackUpBuildArtifact = path.join(pathToBackUpBuildArtifact, contractJsonName);
    await FileHandler.transferFile(pathToBackUpBuildArtifact, pathToContractBuildFile);
}

resetSimbaJson();
resetHardhatArtifacts();