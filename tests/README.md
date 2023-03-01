# Table of Contents:
1. [Summary](#summary)
2. [Setup](#set-up)
3. [Running Tests](#running-tests)
4. [Hardhat Tests](#hardhat-tests)
5. [Truffle Tests](#truffle-tests)
6. [Tests With Coverage](#tests-with-coverage)

## Summary
The tests are currently broken down into 4 sections: auth_store, utils, hardhat, and truffle. The auth_store tests are meant to test the KeycloakHandler and AzureHandler, but AzureHandler is being phased out as of this writing. The utils tests are self-explanatory - test util functions. The bulk of the tests live in truffle and hardhat, and they are meant to test the functionality of web3-suites inside of a hardhat or truffle project.

## Set Up
Since we're mainly concerned with testing the truffle and hardhat directories, you will need to create a .simbachain.env (or simbachain.env or .env) tests/hardhat/ and tests/truffle/ directories. The Truffle tests use the demo environment, and the Hardhat tests use the dev environment. In each environment, the organisation is brendan_birch_simbachain_com, and the app is BrendanTestApp. So you will need to create a client ID and client secret for each of those environments. Then once you have created those credentials, you'll need to set them in the .simbachain.env files you created in your test directories above.

So in tests/hardhat/, your .simbachain.env file should look something like:

```
SIMBA_API_BASE_URL=https://simba-dev-api.platform.simbachain.com/
SIMBA_AUTH_CLIENT_ID=<your client ID created for org brendan_birch_simbachain_com in dev env>
SIMBA_AUTH_CLIENT_SECRET=<your client secret created for org brendan_birch_simbachain_com in dev env>
```

And in tests/truffle/, your .simbachain.env file should look something like:

```
SIMBA_API_BASE_URL=https://simba-demo-api.platform.simbachain.com/
SIMBA_AUTH_CLIENT_ID=<your client ID created for org brendan_birch_simbachain_com in demo env>
SIMBA_AUTH_CLIENT_SECRET=<your client secret created for org brendan_birch_simbachain_com in demo env>
```

And that's it! That's all you need for setup.

## Running Tests
You'll see references to "clean" a lot in the test script names. You should always run the "clean" version of tests. What the clean command does is set / reset the simba.json file in relevant folders, based on the simba.json files that exist in tests/tests_setup/backup_files.

For the actual scripts / commands to run, you can read through package.json, under "scripts". To run any given test, from the root of this project, run from the terminal:

```
npm run <name of test>
```

So to run all clean tests, from the root of this project, run:

```
npm run all_clean_tests
```

## Hardhat Tests
All clean Hardhat tests:

```
npm run hardhat_clean_test
```

All clean Hardhat integration tests:

```
npm run hardhat_clean_integration_test
```

All clean Hardhat unit tests:

```
npm run hardhat_clean_unit_test
```

### Truffle Tests
All clean Truffle tests:

```
npm run truffle_clean_test
```

All clean Truffle integration tests:

```
npm run truffle_clean_integration_test
```

All clean Truffle unit tests:

```
npm run truffle_clean_unit_test
```

### Tests With Coverage
All tests with coverage:

```
npm run all_tests_with_coverage
```

All unit tests with coverage:

```
npm run all_unit_tests_with_coverage
```

All integration tests with coverage:

```
npm run all_integration_tests_with_coverage
```
