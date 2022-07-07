import { AzureHandler } from "./authentication";

async function main() {
    const ah = new AzureHandler();
    await ah.performLogin();
}

main();