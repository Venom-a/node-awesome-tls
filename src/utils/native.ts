/**
 * native.ts — Go server backend
 *
 * Replaces the original koffi/.dll implementation.
 * Instead of loading a native shared library, we talk to the
 * burp-awesome-tls Go server over HTTPS on localhost.
 *
 * Configure the server address via env var:
 *   AWESOME_TLS_SERVER=127.0.0.1:8887  (default)
 */

import https from "https";
import { randomUUID } from "crypto";

const SERVER_ADDR = process.env.AWESOME_TLS_SERVER || "127.0.0.1:8887";
const [SERVER_HOST, SERVER_PORT_STR] = SERVER_ADDR.split(":");
const SERVER_PORT = parseInt(SERVER_PORT_STR, 10);

// Single reusable agent for all localhost connections to the Go server.
// rejectUnauthorized:false is safe here — localhost only, Go handles real TLS.
const localAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

// In-memory session cookie store (replaces what the .dll did internally)
const sessions: Record<string, { cookies: Record<string, string> }> = {};

async function doRequest(payloadStr: string): Promise<string> {
  const payload = JSON.parse(payloadStr);
  const destUrl = new URL(String(payload.requestUrl));
  const sessionId: string = payload.sessionId;

  if (!sessions[sessionId]) sessions[sessionId] = { cookies: {} };

  // Build TransportConfig — matches Go's TransportConfig struct exactly
  const transportConfig: Record<string, any> = {
    Host: destUrl.host,
    Scheme: destUrl.protocol.replace(":", ""),
    HttpTimeout: payload.timeoutMilliseconds
      ? Math.ceil(payload.timeoutMilliseconds / 1000)
      : 30,
    UseInterceptedFingerprint: false,
    ExternalProxyUrl: payload.proxyUrl || "",
    HeaderOrder: Object.keys(payload.headers || {}),
  };

  // Priority: hexClientHello > named fingerprint > default
  if (payload.customTlsClient?.hexClientHello) {
    transportConfig.HexClientHello = payload.customTlsClient.hexClientHello;
    transportConfig.Fingerprint = "";
  } else if (payload.tlsClientIdentifier) {
    transportConfig.HexClientHello = "";
    transportConfig.Fingerprint = payload.tlsClientIdentifier;
  } else {
    transportConfig.HexClientHello = "";
    transportConfig.Fingerprint = "default";
  }

  // Merge session cookies + request cookies
  const requestCookies: { name: string; value: string }[] = payload.requestCookies || [];
  const allCookies = {
    ...sessions[sessionId].cookies,
    ...Object.fromEntries(requestCookies.map((c: any) => [c.name, c.value])),
  };

  // Build final headers
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload.headers || {})) {
    headers[k] = String(v);
  }
  if (Object.keys(allCookies).length > 0) {
    headers["cookie"] = Object.entries(allCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  const bodyStr: string | null =
    payload.requestBody && payload.requestBody !== "null"
      ? typeof payload.requestBody === "string"
        ? payload.requestBody
        : JSON.stringify(payload.requestBody)
      : null;

  const responseId = randomUUID();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: SERVER_HOST,
        port: SERVER_PORT,
        path: destUrl.pathname + destUrl.search,
        method: payload.requestMethod,
        agent: localAgent,
        headers: {
          ...headers,
          Awesometlsconfig: JSON.stringify(transportConfig),
          host: destUrl.host,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const bodyText = payload.isByteResponse
            ? buf.toString("base64")
            : buf.toString("utf8");

          // Parse and persist Set-Cookie headers into session store
          const responseCookies: Record<string, string> = {};
          for (const cookieStr of res.headers["set-cookie"] || []) {
            const [pair] = cookieStr.split(";");
            const eqIdx = pair.indexOf("=");
            if (eqIdx !== -1) {
              const name = pair.slice(0, eqIdx).trim();
              const value = pair.slice(eqIdx + 1).trim();
              responseCookies[name] = value;
              if (payload.withDefaultCookieJar !== false) {
                sessions[sessionId].cookies[name] = value;
              }
            }
          }

          resolve(
            JSON.stringify({
              id: responseId,
              status: res.statusCode || 0,
              headers: res.headers,
              body: bodyText,
              cookies: responseCookies,
              sessionId,
              target: String(payload.requestUrl),
              usedProtocol: "HTTP/1.1",
            })
          );
        });
      }
    );

    req.on("error", (err: Error) =>
      reject(
        new Error(
          `awesome-tls Go server unreachable at ${SERVER_ADDR}: ${err.message}\n` +
          `Start it: cd burp-awesome-tls-main/src-go/server && go run ./cmd/main.go -spoof ${SERVER_ADDR}`
        )
      )
    );

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

export class LibraryHandler {
  // Called by Client.ts on init — verify Go server is reachable
  static async validateFile(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: SERVER_HOST,
          port: SERVER_PORT,
          path: "/",
          method: "HEAD",
          agent: localAgent,
          headers: {
            Awesometlsconfig: JSON.stringify({
              Host: "localhost",
              Scheme: "https",
              Fingerprint: "default",
              HttpTimeout: 5,
              UseInterceptedFingerprint: false,
              ExternalProxyUrl: "",
              HeaderOrder: [],
              HexClientHello: "",
            }),
          },
        },
        () => resolve()
      );
      req.on("error", () =>
        reject(
          new Error(
            `Cannot connect to awesome-tls Go server at ${SERVER_ADDR}.\n` +
            `Start it with:\n` +
            `  cd burp-awesome-tls-main/src-go/server\n` +
            `  go run ./cmd/main.go -spoof ${SERVER_ADDR}`
          )
        )
      );
      req.end();
    });
  }

  static retrieveLibrary() {
    return {
      request:        (payload: string) => doRequest(payload),
      freeMemory:     (_id: string)     => Promise.resolve(),
      destroyAll:     ()                => { Object.keys(sessions).forEach((k) => delete sessions[k]); return Promise.resolve(); },
      destroySession: (payload: string) => { try { const { sessionId } = JSON.parse(payload); delete sessions[sessionId]; } catch {} return Promise.resolve(); },
    };
  }
}
