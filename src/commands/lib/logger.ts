import {
    Logger,
} from "tslog";
const DEBUG = 'debug';
const INFO = 'info';
const ERROR = 'error';
const log: Logger = new Logger({minLevel:DEBUG});

export {
    log,
};
