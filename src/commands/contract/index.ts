export interface ContractDesign {
    id: string;
    name: string;
    version: string;
    language: string;
}

export interface ContractDesignWithCode extends ContractDesign {
    code: string;
}

export {
    allContracts,
    printAllContracts,
} from "./list";

export {
    syncContract,
} from "./sync";
