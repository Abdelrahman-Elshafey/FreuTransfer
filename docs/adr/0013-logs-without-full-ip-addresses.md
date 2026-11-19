# ADR 0013: The server's logs keep no full IP address

- **Status:** accepted (owner, 2026-11-19; full review of 2026-11-18)
- **Date:** 2026-11-19

## Context
nginx wrote a log line per request with the visitor's full IP address, twice (the client address
and Cloudflare's `X-Forwarded-For`), and named it again in an error line for every request refused
by the request limit (stage 7a). The server is an OVHcloud VPS in Singapore (ADR 0002), contracted
with OVH Singapore Pte. Ltd. under Singapore law. Singapore is not on Annex 1 of Switzerland's Data
Protection Ordinance (status 1 Dec 2025), and OVH Singapore's General Terms of Services (17 Jan 2025)
contain no data processing agreement or standard contractual clauses that the privacy page could
name as a safeguard (Swiss FADP, Art. 16 and 19).

## Decision
- The access log keeps the address **shortened**: IPv4 without its last part (203.0.113.7 →
  203.0.113.0), IPv6 to its first two groups (→ 2001:db8::); `X-Forwarded-For` is not logged.
- nginx's error log keeps only critical lines: the other levels name the full client address. Every
  refused (429) or failed (502) request still shows in the access log, shortened; the API logs its
  own errors.
- The request limit still counts per full address, in nginx's memory only, never written.
- The privacy page says so in all four languages. `apps/web/src/nginx.integration.test.ts` reads the
  real container's log and fails if a full address appears in it.

## Alternatives considered
- **Ask OVH Singapore for contract clauses:** possible later; nothing to name until they exist.
- **Move the server to an OVH data centre in the EU:** removes the question (EU countries are on
  Annex 1), but a new server, shared with UrConnections today (ADR 0002).
- **No access log at all:** simplest, but leaves no trace of abuse or of failed requests.

## Consequences
- What is stored in Singapore no longer identifies one connection. A shortened address may still
  count as personal data, and the full address still passes through the server's memory, so this
  reduces the question rather than settling it (not checked by a lawyer).
- Abuse can be traced to a network, not to one address; the request limit itself is unchanged.
