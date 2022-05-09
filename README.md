# web3-suites-common
This project contains code that is common to web3 suite plugins for SIMBA Chain (eg Truffle and Hardhat plugings). The objects in this code base handle authentication (through Keycloak device login), http requests, and file systems operations (mainly searching for contracts and other files in web3 projects).

This project should be installed along with the web3-suite-specific (eg hardhat or truffle) project that you are using. 

## installation
```
$ npm install @simbachain/web3-suites
```