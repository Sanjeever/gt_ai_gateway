/**
 * Mock HTTP Forward Proxy
 *
 * 用于测试供应商代理配置的简单正向代理。
 * 支持 HTTP CONNECT（隧道模式）和普通 HTTP 转发。
 * 记录转发的请求，方便测试断言。
 */
import { createServer, IncomingMessage, ServerResponse } from "http";
import { connect as netConnect } from "net";
import { URL } from "url";


const DEFAULT_PROXY_PORT = 9997;

let server: ReturnType<typeof createServer> | null = null;
let isRunning = false;

// 记录经过代理的请求
let forwardedRequests: Array<{
    method: string;
    url: string;
    host: string;
    port: number;
    timestamp: string;
}> = [];

/**
 * 启动 mock 代理服务器
 */
async function startMockProxy(port: number = DEFAULT_PROXY_PORT): Promise<any> {
    if (isRunning) {
        console.log(`Mock proxy already running on port ${port}`);
        return null;
    }

    return new Promise((resolve, reject) => {
        server = createServer((req: IncomingMessage, res: ServerResponse) => {
            // 测试端点：查询/清空转发记录
            if (req.url === "/_test/requests") {
                if (req.method === "GET") {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(forwardedRequests));
                    return;
                }
                if (req.method === "DELETE") {
                    forwardedRequests = [];
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: true }));
                    return;
                }
            }
            handleForward(req, res);
        });

        // CONNECT 请求需要通过事件处理（createServer 回调不处理 CONNECT）
        server.on("connect", (req: IncomingMessage, clientSocket: any, head: Buffer) => {
            handleConnect(req, clientSocket, head);
        });

        server.on("error", (err) => {
            const nodeError = err as NodeJS.ErrnoException;
            if (nodeError.code === "EADDRINUSE") {
                reject(new Error(`Mock proxy port ${port} already in use`));
            } else {
                reject(err);
            }
        });

        server.listen(port, () => {
            isRunning = true;
            console.log(`Mock HTTP proxy listening on port ${port}`);
            resolve(server);
        });
    });
}

/**
 * 停止 mock 代理服务器
 */
async function stopMockProxy(serverInstance: any): Promise<void> {
    if (serverInstance) {
        return new Promise((resolve) => {
            if (typeof serverInstance.closeAllConnections === "function") {
                serverInstance.closeAllConnections();
            }
            serverInstance.close(() => {
                isRunning = false;
                console.log("Mock HTTP proxy stopped");
                resolve();
            });
        });
    }
}

/**
 * 处理代理请求
 * - CONNECT 方法：建立 TLS 隧道（HTTPS 代理场景）
 * - 其他方法：直接转发 HTTP 请求
 */
function handleProxyRequest(req: IncomingMessage, res: ServerResponse): void {
    console.log(`[Mock Proxy] ${req.method} ${req.url}`);
    if (req.method === "CONNECT") {
        handleConnect(req, res);
    } else {
        handleForward(req, res);
    }
}

/**
 * 处理 CONNECT 请求（TCP 隧道）
 * CONNECT 只是建立 TCP 隧道，TLS 握手由客户端在隧道上层完成。
 */
function handleConnect(req: IncomingMessage, clientSocket: any, head: Buffer): void {
    const [host, portStr] = (req.url || "").split(":");
    const port = parseInt(portStr, 10) || 443;

    // 记录请求
    forwardedRequests.push({
        method: "CONNECT",
        url: req.url || "",
        host,
        port,
        timestamp: new Date().toISOString(),
    });

    console.log(`[Mock Proxy] CONNECT ${host}:${port}`);

    // 建立到目标服务器的 TCP 连接
    const targetSocket = netConnect(port, host, () => {
        console.log(`[Mock Proxy] CONNECT tunnel established to ${host}:${port}`);
        // 通知客户端隧道已建立
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

        // 转发 CONNECT 请求可能携带的初始数据
        if (head && head.length > 0) {
            targetSocket.write(head);
        }

        // 双向管道：客户端 ↔ 目标服务器
        targetSocket.pipe(clientSocket);
        clientSocket.pipe(targetSocket);
    });

    targetSocket.on("error", (err) => {
        console.error(`[Mock Proxy] CONNECT target error: ${err.message}`);
        clientSocket.destroy();
    });

    clientSocket.on("error", (err) => {
        console.error(`[Mock Proxy] CONNECT client error: ${err.message}`);
        targetSocket.destroy();
    });
}

/**
 * 处理普通 HTTP 转发
 */
function handleForward(req: IncomingMessage, res: ServerResponse): void {
    const targetUrl = req.url || "";

    let parsed: URL;
    try {
        parsed = new URL(targetUrl);
    } catch {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad request URL");
        return;
    }

    // 记录请求
    forwardedRequests.push({
        method: req.method || "GET",
        url: targetUrl,
        host: parsed.hostname,
        port: parseInt(parsed.port, 10) || (parsed.protocol === "https:" ? 443 : 80),
        timestamp: new Date().toISOString(),
    });

    console.log(`[Mock Proxy] ${req.method} ${targetUrl}`);

    // 收集请求体
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
        const body = Buffer.concat(chunks);

        const isHttps = parsed.protocol === "https:";
        const requestFn = isHttps ? httpsRequest : httpRequest;

        const proxyReq = requestFn(
            {
                hostname: parsed.hostname,
                port: parsed.port || (isHttps ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: req.method,
                headers: { ...req.headers, host: parsed.host },
            },
            (proxyRes) => {
                res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
                proxyRes.pipe(res);
            },
        );

        proxyReq.on("error", (err) => {
            console.error(`[Mock Proxy] Forward error:`, err.message);
            if (!res.headersSent) {
                res.writeHead(502, { "Content-Type": "text/plain" });
                res.end(`Proxy error: ${err.message}`);
            }
        });

        if (body.length > 0) {
            proxyReq.write(body);
        }
        proxyReq.end();
    });
}

/**
 * 获取所有经过代理的请求记录
 */
function getForwardedRequests(): typeof forwardedRequests {
    return forwardedRequests;
}

/**
 * 清空请求记录
 */
function clearForwardedRequests(): void {
    forwardedRequests = [];
}


export default {
    startMockProxy,
    stopMockProxy,
    getForwardedRequests,
    clearForwardedRequests,
};
