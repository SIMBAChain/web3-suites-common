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
    pullAllMostRecentSolFilesAndSourceCode,
    pullMostRecentRecentSolFileFromContractName,
    pullMostRecentSourceCodeFromContractName,
    pullMostRecentFromContractName,
    pullContractFromDesignId,
    pullSourceCodeForSimbaJson
} from "./pull";

export {
    deleteContractFromDesignID,
    deleteContractsFromPrompts,
} from "./delete";

export {
    addLib,
} from "./addlibrary";

export {
    SourceCodeComparer,
} from "./source_code_comparer";
