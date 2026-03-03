<div align="center">
  <h1>node-tls-client</h1>
  <p>Advanced TLS fingerprinting library powered by the <a href="https://github.com/sleeyax/burp-awesome-tls">burp-awesome-tls</a> Go server.<br/>Supports full <b>Hex Client Hello</b> spoofing from Wireshark captures.</p>
  <p>
    <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node version" />
    <img src="https://img.shields.io/badge/go-%3E%3D1.21-blue" alt="Go version" />
    <img src="https://img.shields.io/badge/license-GPL--3.0-orange" alt="License" />
  </p>
</div>

---

## What is TLS Fingerprinting?

Changing the `User-Agent` header alone is not enough to fool modern bot detection systems. Servers use a technique called **TLS Fingerprinting** (e.g. JA3, JA4) to identify the real client behind a request — regardless of what headers say.

This library defeats TLS fingerprinting by letting you **spoof any browser's exact TLS handshake**, including raw Hex Client Hello records captured directly from Wireshark. It bypasses WAFs like CloudFlare, PerimeterX, Akamai, and DataDome.

---

## How it works

```
Your Node.js code
      │
      │  Session.get / post / etc.
      ▼
awesome-tls Go server  (auto-started by initTLS())
      │
      │  Real HTTPS with spoofed TLS fingerprint
      ▼
Target website
```

The Go server is **automatically started** when you call `initTLS()` and **automatically stopped** when you call `destroyTLS()`. No manual process management needed.

---

## Prerequisites

- **Node.js** >= 18

---

## Quick Start

```javascript
const { Session, ClientIdentifier, initTLS, destroyTLS } = require("node-tls-client");

(async () => {
  await initTLS(); // starts the Go server automatically

  const session = new Session({
    clientIdentifier: ClientIdentifier.chrome_131,
  });

  try {
    const response = await session.get("https://example.com/");
    console.log(response.status, await response.text());
  } finally {
    await session.close();
    await destroyTLS(); // stops the Go server
  }
})();
```

---

## Examples

### Using a named browser fingerprint

```javascript
const { Session, ClientIdentifier, initTLS, destroyTLS } = require("node-tls-client");

(async () => {
  await initTLS();

  const session = new Session({
    clientIdentifier: ClientIdentifier.chrome_131,
    timeout: 30000,
    insecureSkipVerify: false,
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

### Using a Hex Client Hello from Wireshark

Paste the raw hex stream captured from Wireshark to perfectly mimic any device's TLS handshake.

```javascript
const { Session, initTLS, destroyTLS } = require("node-tls-client");

(async () => {
  await initTLS();

  const session = new Session({
    hexClientHello: "160301080e0100080a0303...", // your Wireshark hex stream
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
2. Open the browser or app you want to spoof and make any HTTPS request
3. In Wireshark, apply the filter: `ssl.handshake.type == 1`
4. Right-click the **TLSv1.3 Record Layer: Handshake Protocol: Client Hello** entry
5. Select **Copy → "...as a Hex Stream"**
6. Paste the result as `hexClientHello` in your Session options

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

## API Reference

### `initTLS()`

Starts the awesome-tls Go server process in the background. Must be called before creating any `Session`.

```javascript
await initTLS();
```

---

### `destroyTLS()`

Stops the Go server process and cleans up all sessions.

```javascript
await destroyTLS();
```

---

### `new Session(options)`

Creates a new TLS session with the given configuration.

#### Session Options

| Property | Type | Description |
|---|---|---|
| `hexClientHello` | `string` | Raw TLS Client Hello hex stream from Wireshark. **Highest priority** — overrides all other fingerprint options. |
| `clientIdentifier` | `ClientIdentifier` | Named browser fingerprint e.g. `ClientIdentifier.chrome_131`. Used when no `hexClientHello` is set. |
| `sessionId` | `string` | Custom session ID. Auto-generated if not provided. |
| `headers` | `object` | Default headers sent with every request in this session. |
| `proxy` | `string` | Proxy URL for all requests. Format: `http://user:pass@ip:port` |
| `isRotatingProxy` | `boolean` | Set to `true` if using a rotating proxy. |
| `insecureSkipVerify` | `boolean` | Skip SSL certificate verification. |
| `timeout` | `number` | Request timeout in milliseconds. |
| `debug` | `boolean` | Enable debug logging. |
| `serverNameOverwrite` | `string` | Override the SNI hostname. |
| `disableIPV4` | `boolean` | Disable IPv4. |
| `disableIPV6` | `boolean` | Disable IPv6. |

---

### Session Methods

| Method | Description |
|---|---|
| `get(url, options?)` | Sends a GET request. |
| `post(url, options?)` | Sends a POST request. |
| `put(url, options?)` | Sends a PUT request. |
| `patch(url, options?)` | Sends a PATCH request. |
| `delete(url, options?)` | Sends a DELETE request. |
| `head(url, options?)` | Sends a HEAD request. |
| `options(url, options?)` | Sends an OPTIONS request. |
| `close()` | Closes and destroys the session. |
| `cookies()` | Returns all cookies stored in the session jar. |

---

### Request Options

| Parameter | Type | Description |
|---|---|---|
| `headers` | `object` | Request-level headers (overrides session headers). |
| `body` | `any` | Request body for POST / PUT / PATCH. |
| `proxy` | `string` | Per-request proxy. Format: `http://user:pass@ip:port` |
| `isRotatingProxy` | `boolean` | Whether the proxy is a rotating proxy. |
| `cookies` | `object` | Cookies to send with this request. |
| `followRedirects` | `boolean` | Follow HTTP redirects (default: `false`). |
| `byteResponse` | `boolean` | Return body as plain base64 string instead of text (for binary responses like images). |
| `hostOverride` | `string` | Override the Host header (useful when connecting directly to an IP). |
| `headerOrder` | `string[]` | Override header order for this specific request. |

---

### Response

| Property | Type | Description |
|---|---|---|
| `ok` | `boolean` | `true` if status is 200–299. |
| `status` | `number` | HTTP status code. |
| `headers` | `object` | Response headers. |
| `body` | `string` | Response body as text, or plain base64 if `byteResponse: true`. |
| `cookies` | `object` | Cookies returned in this response. |
| `url` | `string` | Final URL of the response. |

| Method | Description |
|---|---|
| `text()` | Returns the body as a string. |
| `json()` | Parses and returns the body as JSON. |

---

### `ClientIdentifier` enum

Pass as `clientIdentifier` in Session options to use a pre-built browser fingerprint.

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
confirmed_ios  confirmed_android
cloudscraper
```

---

## Fingerprint Priority

When creating a Session, the TLS fingerprint is selected in this order:

```
1. hexClientHello    ← raw Wireshark capture, exact byte-for-byte spoof
2. clientIdentifier  ← pre-built named browser profile
3. chrome_131        ← default fallback
```

---

## References

This library stands on the shoulders of the following open source projects:

- **[sleeyax/burp-awesome-tls](https://github.com/sleeyax/burp-awesome-tls)** — The Go server that powers TLS fingerprint spoofing and `hexClientHello` support. The core engine of this library.
- **[Sahil1337/node-tls-client](https://github.com/Sahil1337/node-tls-client)** — The original Node.js TLS client whose API and `Session` interface this library is fully compatible with.
- **[bogdanfinn/tls-client](https://github.com/bogdanfinn/tls-client)** — The underlying Go TLS client library used by the server, providing all named browser profiles.
- **[bogdanfinn/utls](https://github.com/bogdanfinn/utls)** — The uTLS fork used by the server for raw ClientHello fingerprinting.
- **[refraction-networking/utls](https://github.com/refraction-networking/utls)** — The original uTLS library for TLS fingerprint impersonation.

### Useful Tools

- **[tls.peet.ws](https://tls.peet.ws/)** — Inspect your current TLS fingerprint (JA3, JA4, HTTP/2)
- **[tlsfingerprint.io](https://tlsfingerprint.io/)** — JA3/JA4 fingerprint database
- **[cloudflare.manfredi.io](https://cloudflare.manfredi.io/en/tools/connection)** — Check your Cloudflare bot score
- **[scrapfly.io/web-scraping-tools/http2-fingerprint](https://scrapfly.io/web-scraping-tools/http2-fingerprint)** — HTTP/2 fingerprint checker
- **[kawayiyi.com/tls](https://kawayiyi.com/tls)** — TLS fingerprint inspection tool

---

## License

[GPL-3.0](./LICENSE)
