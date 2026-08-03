# Security

[← Documentation index](../README.md#documentation)

## Posture

The application is public, read-only and stateless. It stores no user accounts, no personal data and no credentials. The attack surface is therefore small but not zero: the server functions make outbound requests on behalf of the client.

## Controls

| Risk | Control |
| --- | --- |
| SSRF via proxy endpoints | Server functions call a fixed allowlist of OSM endpoints; user input is never used as a destination URL |
| Input abuse | All server-function inputs are validated before use |
| Secret exposure | No secrets are required; `process.env` is read only inside handlers and never sent to the client |
| Excessive upstream load | Timeouts, failover and client caching bound request volume |
| Untrusted upstream data | OSM tag values are rendered as text, never as HTML |
| Dependency risk | Worker-compatible, pure-JS dependencies only; advisories reviewed monthly |

## Rules for contributors

- Never construct an outbound request URL from unvalidated user input.
- Never read `process.env` at module scope; read it inside the handler.
- Never render OSM-derived strings via `dangerouslySetInnerHTML`.
- Never log or echo environment values.
- Treat any future admin capability as requiring server-side role validation — never a client flag.

## If authentication is added

Store roles in a dedicated `user_roles` table, check them with a `SECURITY DEFINER` function, enable row-level security on every table, and grant Data API privileges explicitly. Details: [authentication.md](./authentication.md).

## Reporting

Report suspected vulnerabilities privately to the maintainers rather than opening a public issue.
