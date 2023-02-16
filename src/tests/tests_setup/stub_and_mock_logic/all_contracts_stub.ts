import {
    FileHandler,
} from "../file_handler";
import * as path from 'path';
import {cwd} from 'process';

export async function allContractsStubFunc(env: string): Promise<Array<any>> {
    let allContractsArray: Array<any> = [];
    if (env === "dev") {
        allContractsArray = await FileHandler.parsedFile(
            path.join(cwd(),
            "../",
            "tests_setup",
            "stub_and_mock_data",
            "all_contracts_call_dev.json",
        ));
    }
    if (env === "demo") {
        allContractsArray = await FileHandler.parsedFile(
            path.join(cwd(),
            "../",
            "tests_setup",
            "stub_and_mock_data",
            "all_contracts_call_demo.json",
        ));
    }
    return allContractsArray;
}