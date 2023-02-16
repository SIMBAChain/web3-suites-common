export {
    FileHandler,
} from "./file_handler";

export {
    filePaths,
} from "./file_paths";

export {
    testContractVT20AST,
} from "./sample_ast";

export {
    allContractsStubFunc,
} from "./stub_and_mock_logic/all_contracts_stub";

// we need this for stubbing, so we don't receive TypeError: Descriptor for property allContracts is non-configurable and non-writable
import {allContracts as allContracts_original} from "../../commands/contract";
export const allContractsTest = allContracts_original;
