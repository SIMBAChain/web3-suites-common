import { expect } from 'chai';
import 'mocha';
import {
    allContractsStubFunc,
} from "../../../tests_setup";
const contractLib = require("../../../../commands/contract/list");
import {
    allContracts,
} from "../../../../commands/contract/list";

import sinon from "sinon";

describe('testing gathering all contracts', () => {
    it('first entry of results should contain "id" and "name" properties', async () => {
        const fakeContractData = await allContractsStubFunc("dev");
        const sandbox = sinon.createSandbox();
        sandbox.stub(contractLib, "allContracts").callsFake(() => fakeContractData)
        const contracts: any = await allContracts();
        // just a couple lines to make sure we're getting back the right kind of info
        expect("id" in contracts[0]).to.equal(true);
        expect("name" in contracts[0]).to.equal(true);
        expect("version" in contracts[0]).to.equal(true);
        expect("created_on" in contracts[0]).to.equal(true);
        expect("updated_on" in contracts[0]).to.equal(true);
        expect("code" in contracts[0]).to.equal(true);
        expect("language" in contracts[0]).to.equal(true);
        expect("metadata" in contracts[0]).to.equal(true);
        expect("err" in contracts[0]).to.equal(true);
        expect("mode" in contracts[0]).to.equal(true);
        expect("model" in contracts[0]).to.equal(true);
        expect("service_args" in contracts[0]).to.equal(true);
        expect("asset_type" in contracts[0]).to.equal(true);
        expect("organisation" in contracts[0]).to.equal(true);
        expect("designset" in contracts[0]).to.equal(true);

        sandbox.restore();
    }).timeout(1000);
});
