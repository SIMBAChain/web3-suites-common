import {
    SimbaConfig,
} from "../../../../../commands/lib/config";
import {
    AzureHandler,
} from "../../../../../commands/lib/authentication";
import {
    pullContractsInteractive,
    pullAllMostRecentContracts,
    pullAllMostRecentSolFilesAndSourceCode,
    pullMostRecentRecentSolFileFromContractName,
    pullMostRecentFromContractName,
    addLib,
    SourceCodeComparer,
} from "../../../../../commands/contract";
import {
    printAllContracts,
} from "../../../../../commands/contract/list";
import {default as chalk} from 'chalk';
import { expect } from 'chai';
import 'mocha';

describe('testing source code exists in build files', () => { // the tests container
    it('should be false', async () => {
        const scc = new SourceCodeComparer();
        const nonexistentContractName = "ThisDoesNotExist";
        let exists = await scc.sourceCodeExistsInArtifacts(nonexistentContractName);
        expect(exists).to.equal(false);
    });

    it('should be true', async () => {
        const scc = new SourceCodeComparer();
        const existentContractName = "TestContractVT20";
        let exists = await scc.sourceCodeExistsInArtifacts(existentContractName);
        expect(exists).to.equal(true);
    });
});

describe('testing comparison of source code between build files and simba.json', () => { // the tests container
    it('should be false for TestContractVT20 - no change', async () => {
        const scc = new SourceCodeComparer();
        const contractName = "TestContractVT20"
        let changed = await scc.sourceCodeHasChangedOrIsNew(contractName);
        expect(changed).to.equal(false);
    });

    it('should be true for TestContractChanged - comments were added and then recompiled', async () => {
        const scc = new SourceCodeComparer();
        const contractName = "TestContractChanged";
        let changed = await scc.sourceCodeExistsInArtifacts(contractName);
        expect(changed).to.equal(true);
    });
});

describe('testing generation of export status messages', () => { // the tests container
    const choices = [
        {
            title: "TestContractVT20",
            value: null,
        },
        {
            title: "TestContractChanged",
            value: null,
        },
    ]
    it('should be false and no changes detected for TestContractVT20', async () => {
        const scc = new SourceCodeComparer();
        let statuses = await scc.exportStatuses(choices);
        expect(statuses["TestContractVT20"].newOrChanged).to.equal(false);
        expect(statuses["TestContractVT20"].message).to.equal(`${chalk.grey(`No changes detected; not exported`)}`);
    });

    it('should be true and Error encountered with one or more contracts before export for TestContractChanged', async () => {
        const scc = new SourceCodeComparer();
        let statuses = await scc.exportStatuses(choices);
        expect(statuses["TestContractChanged"].newOrChanged).to.equal(true);
        expect(statuses["TestContractChanged"].message).to.equal(`${chalk.redBright(`Error encountered with one or more contracts before export`)}`);
    });
});