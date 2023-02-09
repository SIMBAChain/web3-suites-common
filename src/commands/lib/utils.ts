import { SimbaConfig } from "./config";

export function buildURL(
    baseURL: string,
    url: string,
): string {
    const params = {
        baseURL,
        url,
    };
    SimbaConfig.log.debug(`:: ENTER : ${JSON.stringify(params)}`);
    if (!url.startsWith("http")) {
        if (baseURL.endsWith("/") && url.startsWith("/")) {
            url = url.slice(1);
        }
        if (!baseURL.endsWith("/") && !url.startsWith("/")) {
            url = "/" + url;
        }
        url = baseURL + url;
    }
    SimbaConfig.log.debug(`:: EXIT : url : ${url}`);
    return url;
}