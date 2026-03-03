"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibraryHandler = void 0;

const https  = require("https");
const crypto = require("crypto");
const cp     = require("child_process");
const path   = require("path");
const fs     = require("fs");
const net    = require("net");

// ─── auto-download from GitHub releases ──────────────────────────────────────
const RELEASE_BASE = "https://github.com/Venom-a/node-awesome-tls/releases/download/1.0.0";

const PLATFORM_MAP = {
  win32:  { x64:   "awesome-tls-server-windows-64.exe" },
  linux:  { x64:   "awesome-tls-server-linux-amd64"    },
  darwin: { x64:   "awesome-tls-server-darwin-amd64",
            arm64: "awesome-tls-server-darwin-arm64"    },
};

function getBinaryName() {
  const p = process.platform, a = process.arch;
  const name = PLATFORM_MAP[p] && PLATFORM_MAP[p][a];
  if (!name) throw new Error("[node-awesome-tls] Unsupported platform: " + p + "/" + a);
  return name;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    function get(u) {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
          return get(new URL(res.headers.location, u).toString());
        if (res.statusCode !== 200)
          return reject(new Error("Download failed HTTP " + res.statusCode + " " + u));
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let received = 0;
        const file = fs.createWriteStream(dest);
        res.on("data", (chunk) => {
          received += chunk.length;
          if (total) process.stdout.write("\r[node-awesome-tls] Downloading... " + ((received / total) * 100).toFixed(1) + "%");
        });
        res.pipe(file);
        file.on("finish", () => file.close(() => { process.stdout.write("\n"); resolve(); }));
        file.on("error",  (err) => { fs.unlink(dest, () => {}); reject(err); });
      }).on("error", reject);
    }
    get(url);
  });
}

async function ensureBinary() {
  const binName = getBinaryName();
  const binPath = path.join(__dirname, "..", "..", "bin", binName);
  if (fs.existsSync(binPath)) return binPath;
  const binDir = path.dirname(binPath);
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
  const url = RELEASE_BASE + "/" + binName;
  console.log("[node-awesome-tls] Downloading server binary for " + process.platform + "/" + process.arch + "...");
  console.log("  from: " + url);
  try {
    await downloadFile(url, binPath);
    if (process.platform !== "win32") fs.chmodSync(binPath, 0o755);
    console.log("[node-awesome-tls] Binary ready.");
  } catch (err) {
    throw new Error("[node-awesome-tls] Failed to download binary: " + err.message);
  }
  return binPath;
}

// ─── process management ──────────────────────────────────────────────────────
let serverProcess = null;
let serverAddr    = null;

// Find a random free TCP port
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

// Wait until the Go server is accepting connections
function waitForServer(host, port, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const net = require("net");
    const deadline = Date.now() + timeoutMs;
    function attempt() {
      const sock = new net.Socket();
      sock.setTimeout(500);
      sock.connect(port, host, () => {
        sock.destroy();
        resolve();
      });
      sock.on("error", () => {
        sock.destroy();
        if (Date.now() < deadline) setTimeout(attempt, 100);
        else reject(new Error(`awesome-tls server did not start within ${timeoutMs}ms`));
      });
      sock.on("timeout", () => {
        sock.destroy();
        if (Date.now() < deadline) setTimeout(attempt, 100);
        else reject(new Error(`awesome-tls server did not start within ${timeoutMs}ms`));
      });
    }
    attempt();
  });
}

function startServerProcess() {
  return new Promise(async (resolve, reject) => {
    try {
      // Auto-download binary if not present
      const binPath = await ensureBinary();

      const port = await getFreePort();
      const addr = `127.0.0.1:${port}`;

      serverProcess = cp.spawn(binPath, ["--spoof", addr], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Also accept AWESOME_TLS_ADDR= line if the newer binary prints it
      serverProcess.stdout.on("data", (data) => {
        const line = data.toString().trim();
        const match = line.match(/AWESOME_TLS_ADDR=(.+)/);
        if (match && !serverAddr) {
          serverAddr = match[1];
        }
      });

      serverProcess.stderr.on("data", (_data) => {
        // console.error("[awesome-tls]", _data.toString().trim());
      });

      serverProcess.on("error", (err) => {
        reject(new Error(`Failed to start awesome-tls server: ${err.message}`));
      });

      serverProcess.on("exit", (code) => {
        serverProcess = null;
        serverAddr    = null;
        if (code !== 0 && code !== null) {
          console.error(`[awesome-tls] server exited with code ${code}`);
        }
      });

      // Kill server when Node process exits
      process.on("exit",    () => { if (serverProcess) serverProcess.kill(); });
      process.on("SIGINT",  () => { if (serverProcess) serverProcess.kill(); process.exit(); });
      process.on("SIGTERM", () => { if (serverProcess) serverProcess.kill(); process.exit(); });

      // Wait until the port is actually accepting connections (works with any binary version)
      await waitForServer("127.0.0.1", port);
      serverAddr = addr;
      resolve(serverAddr);
    } catch (err) {
      reject(err);
    }
  });
}

function stopServerProcess() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    serverAddr    = null;
  }
}

// ─── HTTP client ─────────────────────────────────────────────────────────────
let localAgent = null;

function getAgent() {
  if (!localAgent) {
    localAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
  }
  return localAgent;
}

const sessions = {};

async function doRequest(payloadStr) {
  if (!serverAddr) throw new Error("awesome-tls server not running. Call initTLS() first.");

  const payload  = JSON.parse(payloadStr);
  const destUrl  = new URL(String(payload.requestUrl));
  const sessionId = payload.sessionId;

  if (!sessions[sessionId]) sessions[sessionId] = { cookies: {} };

  const [sHost, sPort] = serverAddr.split(":");

  const transportConfig = {
    Host:                      destUrl.host,
    Scheme:                    destUrl.protocol.replace(":", ""),
    HttpTimeout:               payload.timeoutMilliseconds ? Math.ceil(payload.timeoutMilliseconds / 1000) : 30,
    UseInterceptedFingerprint: false,
    ExternalProxyUrl:          payload.proxyUrl || "",
    HeaderOrder:               Object.keys(payload.headers || {}),
  };

  if (payload.customTlsClient?.hexClientHello) {
    transportConfig.HexClientHello = payload.customTlsClient.hexClientHello;
    transportConfig.Fingerprint    = "";
  } else if (payload.tlsClientIdentifier) {
    transportConfig.HexClientHello = "";
    transportConfig.Fingerprint    = payload.tlsClientIdentifier;
  } else {
    transportConfig.HexClientHello = "";
    transportConfig.Fingerprint    = "default";
  }

  const requestCookies = payload.requestCookies || [];
  const allCookies = {
    ...sessions[sessionId].cookies,
    ...Object.fromEntries(requestCookies.map((c) => [c.name, c.value])),
  };

  const headers = {};
  for (const [k, v] of Object.entries(payload.headers || {})) headers[k] = String(v);
  if (Object.keys(allCookies).length > 0) {
    headers["cookie"] = Object.entries(allCookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  const bodyStr = payload.requestBody && payload.requestBody !== "null"
    ? typeof payload.requestBody === "string" ? payload.requestBody : JSON.stringify(payload.requestBody)
    : null;

  const responseId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: sHost,
      port:     parseInt(sPort, 10),
      path:     destUrl.pathname + destUrl.search,
      method:   payload.requestMethod,
      agent:    getAgent(),
      headers: {
        ...headers,
        Awesometlsconfig: JSON.stringify(transportConfig),
        host: destUrl.host,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf      = Buffer.concat(chunks);
        const bodyText = payload.isByteResponse ? buf.toString("base64") : buf.toString("utf8");

        const responseCookies = {};
        for (const cookieStr of res.headers["set-cookie"] || []) {
          const [pair] = cookieStr.split(";");
          const eqIdx  = pair.indexOf("=");
          if (eqIdx !== -1) {
            const name  = pair.slice(0, eqIdx).trim();
            const value = pair.slice(eqIdx + 1).trim();
            responseCookies[name] = value;
            if (payload.withDefaultCookieJar !== false) sessions[sessionId].cookies[name] = value;
          }
        }

        resolve(JSON.stringify({
          id:           responseId,
          status:       res.statusCode || 0,
          headers:      res.headers,
          body:         bodyText,
          cookies:      responseCookies,
          sessionId,
          target:       String(payload.requestUrl),
          usedProtocol: "HTTP/1.1",
        }));
      });
    });

    req.on("error", (err) => reject(new Error(`awesome-tls request failed: ${err.message}`)));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── LibraryHandler ──────────────────────────────────────────────────────────
class LibraryHandler {
  static async validateFile() {
    // Start the server process — this replaces downloading the .dll
    await startServerProcess();
  }

  static stopServer() {
    stopServerProcess();
  }

  static retrieveLibrary() {
    return {
      request:        (payload) => doRequest(payload),
      freeMemory:     (_id)     => Promise.resolve(),
      destroyAll:     ()        => { Object.keys(sessions).forEach((k) => delete sessions[k]); return Promise.resolve(); },
      destroySession: (payload) => { try { const { sessionId } = JSON.parse(payload); delete sessions[sessionId]; } catch {} return Promise.resolve(); },
    };
  }
}

exports.LibraryHandler = LibraryHandler;
