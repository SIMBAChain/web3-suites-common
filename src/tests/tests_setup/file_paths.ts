// file paths should be relative to the top level of the project (where package.json lives),
// since that's where the tests will be run from
export const filePaths: any = {
    devHardhatSimbaJson: {
        inputPath: "src/tests_setup/simba.json",
        outputPath: "./simba.json",
    }
}

export const removeFilePaths: any = {
    authConfigJson: "./authconfig.json",
}