"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;

const native_1 = require("../utils/native");
const utils_1  = require("../utils");

class Client {
    static instance   = null;
    static ready      = false;
    static readyPromise = null;

    // Instead of Piscina worker threads, we call native directly.
    // The Go server handles concurrency — no need for CPU threads here.
    static async init() {
        if (Client.ready) return;
        if (!Client.readyPromise) {
            Client.readyPromise = (async () => {
                await native_1.LibraryHandler.validateFile(); // starts the Go server
                Client.instance = new Client();
                Client.ready = true;
                Client.readyPromise = null;
            })();
        }
        return Client.readyPromise;
    }

    static async destroy() {
        if (!Client.instance) {
            throw new utils_1.TlsClientError("Client not initialized. Call initTLS() first.");
        }
        const lib = native_1.LibraryHandler.retrieveLibrary();
        await lib.destroyAll();
        native_1.LibraryHandler.stopServer();
        Client.instance = null;
        Client.ready    = false;
    }

    static getInstance() {
        if (!Client.instance) {
            throw new utils_1.TlsClientError("Client not initialized. Call initTLS() first.");
        }
        return Client.instance;
    }

    // Mimics the Piscina pool.run() interface that Session.ts uses
    get pool() {
        const lib = native_1.LibraryHandler.retrieveLibrary();
        return {
            run: async (payload, options) => {
                const name = options?.name || "request";
                if (name === "request")        return lib.request(payload);
                if (name === "destroySession") return lib.destroySession(payload);
                if (name === "destroyAll")     return lib.destroyAll();
                if (name === "freeMemory")     return lib.freeMemory(payload);
            }
        };
    }

    static isReady() {
        return Client.ready;
    }
}

exports.Client = Client;
