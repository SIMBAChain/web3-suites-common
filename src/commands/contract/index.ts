export interface ContractDesign {
    id: string;
    name: string;
    version: string;
    language: string;
    created_on: string;
    updated_on: string;
}

export interface ContractDesignWithCode extends ContractDesign {
    code: string;
}

export {
    allContracts,
    printAllContracts,
} from "./list";

export {
    pullContractsInteractive,
    pullAllMostRecentContracts,
} from "./pull";

export {
    addLib,
} from "./addlibrary";

export {
    SourceCodeComparer,
} from "./source_code_comparer";
