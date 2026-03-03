"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const crypto_1 = require("crypto");
const Cookie_1 = require("./Cookie");
const interface_1 = require("../interface");
const utils_1 = require("../utils");
const Client_1 = require("./Client");
const Response_1 = require("./Response");
const __version__ = "1.0.0";
class Session {
    config;
    jar = new Cookie_1.Cookies();
    sessionId = (0, crypto_1.randomUUID)();
    constructor(config = {}) {
        this.config = config;
    }
    async cookies() {
        return this.jar.fetchAllCookies();
    }
    get(url, options = {}) { return this.execute("GET", url, options); }
    delete(url, options = {}) { return this.execute("DELETE", url, options); }
    options(url, options = {}) { return this.execute("OPTIONS", url, options); }
    head(url, options = {}) { return this.execute("HEAD", url, options); }
    post(url, options = {}) { return this.execute("POST", url, options); }
    patch(url, options = {}) { return this.execute("PATCH", url, options); }
    put(url, options = {}) { return this.execute("PUT", url, options); }
    async close() {
        return Client_1.Client.getInstance().pool?.run(JSON.stringify({
            sessionId: this.sessionId,
        }), { name: "destroySession" });
    }
    async execute(method, url, options = {}) {
        const headers = options?.headers !== undefined
            ? options.headers
            : this.config.headers ?? this.getDefaultHeaders();
        const requestCookies = await this.jar.mergeCookies(options?.cookies || {}, url.toString());
        const payload = {
            sessionId: this.sessionId,
            followRedirects: options.followRedirects ?? false,
            withDebug: this.config.debug ?? false,
            headers,
            headerOrder: options.headerOrder || this.config.headerOrder || [],
            insecureSkipVerify: this.config.insecureSkipVerify ?? false,
            proxyUrl: options.proxy || this.config.proxy || "",
            isRotatingProxy: options?.isRotatingProxy ?? this.config.isRotatingProxy ?? false,
            requestUrl: url,
            requestMethod: method,
            requestBody: options?.body || null,
            timeoutMilliseconds: this.config.timeout || 0,
            isByteResponse: options?.byteResponse ?? false,
            isByteRequest: (0, utils_1.isByteRequest)(headers),
            requestHostOverride: options?.hostOverride || null,
            disableIPV6: this.config.disableIPV6 ?? false,
            disableIPV4: this.config.disableIPV4 ?? false,
            serverNameOverwrite: this.config.serverNameOverwrite ?? "",
            connectHeaders: this.config.connectHeaders ?? options.connectHeaders ?? {},
            localAddress: this.config.localAddress ?? null,
            withDefaultCookieJar: true,
            withoutCookieJar: false,
            requestCookies,
        };
        if (this.config.hexClientHello) {
            payload["customTlsClient"] = { hexClientHello: this.config.hexClientHello };
        }
        else if (this.config.clientIdentifier) {
            payload["tlsClientIdentifier"] = this.config.clientIdentifier;
        }
        else {
            payload["tlsClientIdentifier"] = interface_1.ClientIdentifier.chrome_131;
        }
        const requestPayloadString = JSON.stringify(payload);
        const rawResponse = await Client_1.Client.getInstance().pool.run(requestPayloadString, {
            name: "request",
        });
        const response = JSON.parse(rawResponse);
        const cookies = await this.jar.syncCookies(response.cookies || {}, url.toString());
        setImmediate(() => { this.freeMemory(response.id).catch(() => {}); });
        return new Response_1.Response({ ...response, cookies });
    }
    async freeMemory(id) {
        return Client_1.Client.getInstance().pool?.run(id.toString(), { name: "freeMemory" });
    }
    getDefaultHeaders() {
        return {
            "User-Agent": `node-awesome-tls/${__version__}`,
            "Accept-Encoding": "gzip, deflate, br",
            Accept: "*/*",
            Connection: "keep-alive",
        };
    }
}
exports.Session = Session;
