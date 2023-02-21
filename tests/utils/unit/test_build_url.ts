import {
    buildURL,
} from "../../../src/commands/lib/utils";

import { expect } from 'chai';
import 'mocha';

describe('testing buildURL', () => {
    it('should be same, regardless of slashes', () => {
        let baseURL = "https://simba-dev-api.platform.simbachain.com/";
        let endpoint = "/v2/organisations"
        const expectedURL = "https://simba-dev-api.platform.simbachain.com/v2/organisations";
        let fullURL = buildURL(baseURL, endpoint);
        expect(fullURL).to.equal(expectedURL);

        baseURL = "https://simba-dev-api.platform.simbachain.com";
        fullURL = buildURL(baseURL, endpoint);
        expect(fullURL).to.equal(expectedURL);

        endpoint = "v2/organisations";
        fullURL = buildURL(baseURL, endpoint);
        expect(fullURL).to.equal(expectedURL);

        baseURL = "https://simba-dev-api.platform.simbachain.com";
        fullURL = buildURL(baseURL, endpoint);
        expect(fullURL).to.equal(expectedURL);
    });

    it('should just be endpoint, since it starts with http', () => {
        let baseURL = "https://simba-dev-api.platform.simbachain.com/";
        let endpoint = "https://www.google.com/"
        let fullURL = buildURL(baseURL, endpoint);
        expect(fullURL).to.equal(endpoint);
    });
});
