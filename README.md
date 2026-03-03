<div align="center">
  <h1>node-awesome-tls</h1>
  <p>Advanced TLS fingerprinting library powered by <a href="https://github.com/sleeyax/burp-awesome-tls">burp-awesome-tls</a>.<br/>Spoof any browser's exact TLS handshake using <b>Hex Client Hello</b> from Wireshark or named browser profiles.</p>
  <p>
    <a href="https://www.npmjs.com/package/node-awesome-tls"><img src="https://img.shields.io/npm/v/node-awesome-tls" alt="NPM version" /></a>
    <a href="https://www.npmjs.com/package/node-awesome-tls"><img src="https://img.shields.io/npm/dt/node-awesome-tls" alt="NPM downloads" /></a>
    <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node version" />
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  </p>
</div>

---

## What is TLS Fingerprinting?

Changing the `User-Agent` header alone is not enough to fool modern bot detection. Servers use **TLS Fingerprinting** (JA3, JA4) to identify the real client behind a request — regardless of what headers say.

`node-awesome-tls` defeats this by spoofing the exact TLS handshake of any browser or device, including byte-for-byte replays of real captures from Wireshark. It bypasses WAFs like Cloudflare, PerimeterX, Akamai, and DataDome.

---

## How it works

```
Your Node.js code
      │
      ▼
node-awesome-tls  ──→  awesome-tls Go server (auto-started)
                               │
                               │  Real HTTPS with spoofed TLS fingerprint
                               ▼
                         Target website
```

The Go server binary is **downloaded automatically** on first `initTLS()` call and **started/stopped automatically** — no Go installation, no manual steps.

---

## Installation

```bash
npm install node-awesome-tls
```

---

## Quick Start

```javascript
const { Session, ClientIdentifier, initTLS, destroyTLS } = require("node-awesome-tls");

(async () => {
  await initTLS(); // downloads binary if needed, starts server

  const session = new Session({
    clientIdentifier: ClientIdentifier.chrome_131,
  });

  try {
    const response = await session.get("https://example.com/");
    console.log(response.status);
    console.log(await response.text());
  } finally {
    await session.close();
    await destroyTLS();
  }
})();
```

---

## Examples

### Hex Client Hello (Wireshark capture)

The most powerful mode — replays a real browser's exact TLS handshake byte-for-byte.

```javascript
const { Session, initTLS, destroyTLS } = require("node-awesome-tls");

(async () => {
  await initTLS();

  const session = new Session({
    hexClientHello: "160301080e...", // hex stream from Wireshark
  });

  const response = await session.get("https://cloudflare.manfredi.io/test/", {
    headers: {
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.5",
      "accept-encoding": "gzip, deflate, br",
    },
  });

  console.log(response.status);
  console.log(response.body);

  await session.close();
  await destroyTLS();
})();
```

#### How to capture a Hex Client Hello from Wireshark

1. Start a Wireshark capture on your network interface
2. Make any HTTPS request from the browser/app you want to spoof
3. Filter: `ssl.handshake.type == 1`
4. Right-click **TLSv1.3 Record Layer: Handshake Protocol: Client Hello**
5. Select **Copy → "...as a Hex Stream"**
6. Paste as `hexClientHello` in your Session

---

### Named browser fingerprint

```javascript
const { Session, ClientIdentifier, initTLS, destroyTLS } = require("node-awesome-tls");

(async () => {
  await initTLS();

  const session = new Session({
    clientIdentifier: ClientIdentifier.chrome_131,
    timeout: 30000,
  });

  const response = await session.get("https://example.com", {
    headers: { "accept-language": "en-US,en;q=0.9" },
    proxy: "http://user:pass@ip:port",
    followRedirects: true,
    cookies: { session_id: "abc123" },
  });

  console.log(response.status);
  console.log(await response.json());

  await session.close();
  await destroyTLS();
})();
```

---

### Binary response (images, files)

```javascript
const response = await session.get("https://example.com/image.png", {
  byteResponse: true,
});

// response.body is a plain base64 string
const buffer = Buffer.from(response.body, "base64");
require("fs").writeFileSync("image.png", buffer);
```

---

### POST request

```javascript
const response = await session.post("https://api.example.com/login", {
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "user", password: "pass" }),
});

const data = await response.json();
```

---

## API

### `initTLS()`

Downloads the server binary if not present, then starts it. Must be called before any `Session`.

```javascript
await initTLS();
```

---

### `destroyTLS()`

Stops the server and cleans up all sessions.

```javascript
await destroyTLS();
```

---

### `new Session(options)`

#### Session Options

| Property | Type | Description |
|---|---|---|
| `hexClientHello` | `string` | Raw TLS Client Hello hex stream from Wireshark. **Highest priority.** |
| `clientIdentifier` | `ClientIdentifier` | Named browser fingerprint e.g. `ClientIdentifier.chrome_131`. |
| `sessionId` | `string` | Custom session ID. Auto-generated if not provided. |
| `headers` | `object` | Default headers for all requests in this session. |
| `headerOrder` | `string[]` | Default header order for all requests. |
| `connectHeaders` | `object` | Headers for CONNECT requests (proxy tunneling). |
| `proxy` | `string` | Proxy for all requests. Format: `http://user:pass@ip:port` |
| `isRotatingProxy` | `boolean` | Set `true` for rotating proxies. |
| `timeout` | `number` | Request timeout in milliseconds. |
| `insecureSkipVerify` | `boolean` | Skip SSL certificate verification. |
| `serverNameOverwrite` | `string` | Override the SNI hostname. |
| `localAddress` | `string` | Bind requests to a specific local IP address. |
| `disableIPV4` | `boolean` | Disable IPv4. |
| `disableIPV6` | `boolean` | Disable IPv6. |
| `debug` | `boolean` | Enable debug logging. |

---

### Session Methods

| Method | Description |
|---|---|
| `get(url, options?)` | GET request |
| `post(url, options?)` | POST request |
| `put(url, options?)` | PUT request |
| `patch(url, options?)` | PATCH request |
| `delete(url, options?)` | DELETE request |
| `head(url, options?)` | HEAD request |
| `options(url, options?)` | OPTIONS request |
| `close()` | Destroy this session |
| `cookies()` | Get all session cookies |

---

### Request Options

| Parameter | Type | Description |
|---|---|---|
| `headers` | `object` | Request headers (overrides session headers). |
| `body` | `any` | Request body for POST/PUT/PATCH. |
| `proxy` | `string` | Per-request proxy. Format: `http://user:pass@ip:port` |
| `isRotatingProxy` | `boolean` | Set `true` for rotating proxies. |
| `cookies` | `object` | Cookies to send. |
| `followRedirects` | `boolean` | Follow redirects (default: `false`). |
| `byteResponse` | `boolean` | Return body as plain base64 (for binary responses). |
| `hostOverride` | `string` | Override the Host header. |
| `headerOrder` | `string[]` | Custom header order for this request. |
| `connectHeaders` | `object` | Headers for CONNECT requests (proxy tunneling). |

---

### Response

| Property | Type | Description |
|---|---|---|
| `ok` | `boolean` | `true` if status 200–299. |
| `status` | `number` | HTTP status code. |
| `headers` | `object` | Response headers. |
| `body` | `string` | Body as text, or base64 if `byteResponse: true`. |
| `cookies` | `object` | Response cookies. |
| `url` | `string` | Final URL after redirects. |

| Method | Description |
|---|---|
| `text()` | Body as string. |
| `json()` | Body parsed as JSON. |

---

### `ClientIdentifier` enum

**Chrome**
```
chrome_103  chrome_104  chrome_105  chrome_106  chrome_107  chrome_108
chrome_109  chrome_110  chrome_111  chrome_112  chrome_116_PSK
chrome_116_PSK_PQ  chrome_117  chrome_120  chrome_124  chrome_131  chrome_131_psk
```

**Firefox**
```
firefox_102  firefox_104  firefox_105  firefox_106  firefox_108  firefox_110
firefox_117  firefox_120  firefox_123  firefox_132  firefox_133
```

**Safari**
```
safari_15_6_1  safari_16_0  safari_ipad_15_6
safari_ios_15_5  safari_ios_15_6  safari_ios_16_0  safari_ios_17_0  safari_ios_18_0
```

**Opera**
```
opera_89  opera_90  opera_91
```

**Mobile / Other**
```
okhttp4_android_7   okhttp4_android_8   okhttp4_android_9   okhttp4_android_10
okhttp4_android_11  okhttp4_android_12  okhttp4_android_13
zalando_android_mobile  zalando_ios_mobile
nike_ios_mobile  nike_android_mobile
mms_ios  mms_ios_1  mms_ios_2  mms_ios_3
mesh_ios  mesh_ios_1  mesh_ios_2
mesh_android  mesh_android_1  mesh_android_2
confirmed_ios  confirmed_android  cloudscraper
```

---

## Fingerprint Priority

```
1. hexClientHello    ← exact byte-for-byte Wireshark capture
2. clientIdentifier  ← named browser profile
3. chrome_131        ← default fallback
```

---

## Supported Platforms

| Platform | Architecture | Binary |
|---|---|---|
| Windows | x64 | `awesome-tls-server-windows-64.exe` |
| Linux | x64 | `awesome-tls-server-linux-amd64` |
| macOS | Intel (x64) | `awesome-tls-server-darwin-amd64` |
| macOS | Apple Silicon (arm64) | `awesome-tls-server-darwin-arm64` |

---

## References

- **[sleeyax/burp-awesome-tls](https://github.com/sleeyax/burp-awesome-tls)** — Go server powering TLS fingerprint spoofing and hexClientHello support.
- **[Sahil1337/node-tls-client](https://github.com/Sahil1337/node-tls-client)** — Original Node.js TLS client this library is API-compatible with.
- **[bogdanfinn/tls-client](https://github.com/bogdanfinn/tls-client)** — Underlying Go TLS client providing all named browser profiles.
- **[bogdanfinn/utls](https://github.com/bogdanfinn/utls)** — uTLS fork enabling raw ClientHello fingerprinting.
- **[refraction-networking/utls](https://github.com/refraction-networking/utls)** — Original uTLS library for TLS fingerprint impersonation.

### Useful Tools

- **[tls.peet.ws](https://tls.peet.ws/)** — Inspect your TLS fingerprint (JA3, JA4, HTTP/2)
- **[tlsfingerprint.io](https://tlsfingerprint.io/)** — JA3/JA4 fingerprint database
- **[cloudflare.manfredi.io](https://cloudflare.manfredi.io/en/tools/connection)** — Check your Cloudflare bot score
- **[scrapfly.io/web-scraping-tools/http2-fingerprint](https://scrapfly.io/web-scraping-tools/http2-fingerprint)** — HTTP/2 fingerprint checker

---

## License

[MIT](./LICENSE)
