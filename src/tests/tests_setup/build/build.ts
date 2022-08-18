import {
    FileHandler,
    filePaths,
} from "..";

async function main() {
    for (const item in filePaths) {
        const entry = filePaths[item] 
        const inputPath = entry.inputPath;
        const outputPath = entry.outputPath;
        await FileHandler.transferFile(inputPath, outputPath);
    }
}

main();
