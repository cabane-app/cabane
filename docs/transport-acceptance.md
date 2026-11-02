# Session transport acceptance

Standalone real-device launch requires browser-trusted HTTPS dashboard delivery and HTTPS
Home Assistant token requests with WSS connections. HTTP is permitted only for
paired loopback development endpoints (`localhost`, IPv4 `127.0.0.0/8`, IPv6
`[::1]`). Local demo and construction still work over HTTP without HA.
A loopback endpoint refers to the browser's machine, not another LAN machine.
Standalone sessions have no private-tunnel or ordinary LAN HTTP bypass.

The native panel borrows HA's existing connection and accepts matching HTTP or
HTTPS page/host/workspace origins. Different schemes, hosts and ports are rejected.
LAN HTTP works without a secure-context override, but remains unencrypted. HTTPS
is recommended. Native startup is checked in the DOM harness; real IndexedDB
model storage, UUID generation and SHA-256 fallback are checked at a synthetic
non-loopback HTTP browser origin;
this does not establish live household or network acceptance.

The UI validates transport before sign-in. The runtime independently checks it
before loading saved credentials or invoking the authentication SDK, including
OAuth callbacks and restoration. Rejected callbacks are removed from the URL.
This cannot defend an HTTP page whose JavaScript was replaced in transit.
Production infrastructure must enforce HTTPS delivery itself.

## Automated verification

Automated tests exercise HTTP/HTTP, HTTP/HTTPS, HTTPS/HTTP, HTTPS/HTTPS and
paired IPv4/IPv6 loopback exceptions. Runtime tests use synthetic tokens and a
mocked authentication boundary; no household HA connection is made.

No release deployment URL or TLS-serving configuration is established by this
change. Actual release TLS acceptance remains **unverified and a launch gate**.
The local Vite HTTP server is a development target, not evidence of production
TLS. Docker/Compose and LAN deployment acceptance remain incomplete.

## Required checks on the chosen release target

- Verify the dashboard HTTPS certificate is trusted and matches its hostname.
- Verify HTTP is rejected or redirects to HTTPS before serving application code;
  configure HSTS appropriately for the production hostname.
- Verify the HA endpoint certificate is trusted, token requests remain HTTPS,
  and the authenticated WebSocket uses WSS with no insecure redirects.
- In the intended browser/network, verify sign-in, callback, restoration, and
  reconnection. Check mixed-content, CORS and private-network restrictions.
- Record the exact target, date, browser and observed results before launch.

A successful static build or mocked test does not complete these checks.
