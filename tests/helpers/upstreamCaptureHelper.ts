import { fetch } from "undici";
import config from "../config";

interface CapturedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    json: any | null;
    receivedAt: string;
}


function getCaptureUrl(): string {
    return `${config.UPSTREAM_CONFIG.mock.url}/_test/requests`;
}


async function list(): Promise<CapturedRequest[]> {
    const response = await fetch(getCaptureUrl());
    if (!response.ok) {
        throw new Error(`Failed to list upstream captured requests: ${response.status}`);
    }
    return await response.json() as CapturedRequest[];
}


async function waitForRequestsByInput(
    input: string,
    timeoutMs = 2000,
): Promise<CapturedRequest[]> {
    const startAt = Date.now();

    while (Date.now() - startAt < timeoutMs) {
        const requests = await list();
        const matchedRequests = requests.filter((request) => request.json?.input === input);

        if (matchedRequests.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const settledRequests = await list();
            return settledRequests.filter((request) => request.json?.input === input);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`No upstream captured request found for input: ${input}`);
}


export type { CapturedRequest };

export default {
    list,
    waitForRequestsByInput,
};
