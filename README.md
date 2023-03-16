# web3-suites-common

## Summary
This project contains code that is common to web3 suite plugins for SIMBA Chain (eg Truffle and Hardhat plugings). The objects in this code base handle authentication (through Keycloak device login), http requests, and file systems operations (mainly searching for contracts and other files in web3 projects).

This module does not need to be installed in the web3 project you are using. The Simba web3 plugins install this module, and thus the logic inside this module is abstracted away from the end user. So the layers are:

@simbachain/web3-suites 
->
simba chain plugin (eg @simbachain/hardhat) 
->
web3 project (eg a hardhat project)

So a developer will not be exposed to the code contained in this module.

## Installation

Installation only needs to be performed by devs working on the @simbachain/truffle and @simbachain/hardhat plugins. For such installation, run:

```
$ npm install @simbachain/web3-suites
```

## Usage
As stated above, developers will not directly be using this module's code in their web3 projects. But some notes on how this code and its objects are structured is provided here.

### Static vs. Non-Static Methods
The code in this module has been written so that methods for SimbaConfig can usually be called as either static or non-static methods, but will achieve the same result. So sometimes in the web3 plugins that use this library, you will see something like config.ProjectConfigStore.get("clientID"), while other times you will see SimbaConfig.ProjectConfigStore.get("clientID"). Both code examples do the same thing. The reason for this is that the truffle plugin was written first, and used instances of SimbaConfig, while the Hardhat plugin was built after, and mainly used static methods. So this was an attempt to not break the Truffle plugin interface.

### SimbaConfig.ConfigStore vs. SimbaConfig.ProjectConfigStore
This project uses Configstore objects from the configstore library to manage auth and config info. When you see references to SimbaConfig.ConfigStore, understand that this object operates on and interacts with a .json file containing auth info (authconfig.json). When you see a reference to SimbaConfig.ProjectConfigStore, understand that this object operates on and interacts with a .json file containing project info for the user's web3 project (simba.json).

### Authentication and HTTP Requests
Auth and HTTP requests are handled by SimbaConfig.authStore. SimbaConfig.authStore is actually instantiated by passing the SimbaConfig.ProjectConfigStore property and SimbaConfig.ConfigStore property. So the ProjectConfigStore and ConfigStore properties are the same for both SimbaConfig and SimbaConfig.authStore. In other words, SimbaConfig.authStore.projectConfig === SimbaConfig.ProjectConfigStore. Access / Auth tokens obtained by SimbaConfig.authStore are stored in SimbaConfig.ConfigStore (or SimbaConfig.authStore.configStore).
