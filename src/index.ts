// In this file, we would have a config variable that would
// cause this file to behave differently, based on whether
// we are using truffle or hardhat
// this would probably be the best approach if we are going to have all
// of the common command logic for both (all) suites sit in this repo

// if we separate the command (truffle) and task (hardhat) logic into their
// respective repos, then we would want to just have separate index.ts files
// in each of those repos