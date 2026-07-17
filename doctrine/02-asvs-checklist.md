# 02. ASVS 5.0 Checklist

**Doctrine ID:** `02-asvs-checklist`
**Mode:** review
**Source standards:** OWASP Application Security Verification Standard 5.0

---

## Purpose

This is the coverage backstop of the whole skill. It runs last in the review, after every targeted doctrine pass has already been worked, and its job is to catch what those passes missed. The targeted doctrine files go deep on the areas most likely to be broken; this file goes wide, so that an area nobody thought to look at gets recorded as unlooked-at rather than quietly omitted. A row here that the targeted passes already settled is cheap to tick. A row here that nobody has an answer for is the entire reason the file exists.

## Principles

1. **Wide beats deep, here and only here.** Every other doctrine file earns its place by going deep on one area. This one earns its place by refusing to let an area go unmentioned. Do not turn it into a second investigation; turn it into an honest map of what got investigated.

2. **The gap is the product.** The valuable output of this pass is not the ticked rows. It is the rows you cannot fill, because those are the areas your review did not reach. Under Rule 3, a row you cannot back with a grep or a file read in this turn is not a pass, it is a gap. Write it down as one.

3. **Chapter names are stable, chapter numbers drift.** ASVS renumbers between versions and 5.0 restructured heavily against 4.x. Cite the chapter by name first. Where a number is given below, it is a best reading of 5.0 structure, not a guarantee. If a number turns out to be wrong, the control is still the control.

4. **Alignment is not certification.** Working this checklist produces an ASVS-aligned review. It does not produce an ASVS certification, and the report must never imply that it does. Certification is a formal process with a verifier who is not you. See the closing section.

5. **A level chosen after the fact is not a level.** Pick the assessment level at the start, state it to the user, and hold it. Choosing L1 once the findings are in, so that the L2 rows can be marked out of scope, is a way of scoring yourself.

## Levels

ASVS defines three verification levels. They are cumulative: L2 includes all of L1, L3 includes all of L2.

| Level | ASVS intent | Read it as |
|---|---|---|
| L1 | Baseline, testable largely from outside the application | A floor. Proves the obvious holes are absent. Proves very little else. |
| L2 | The recommended level for most applications, especially any handling sensitive data | The default. This is where a real review lives. |
| L3 | For applications where compromise is a safety event, a financial catastrophe, or an existential one | Reserved. Expensive, and correctly so. |

Be opinionated about this, because the user often will not be:

- **Most applications should be assessed at L2.** If the application holds personal data, handles money, carries authenticated sessions, or has any tenant boundary worth the name, L2 is the honest baseline. Assess at L2 by default and argue up or down from there.
- **L1 is a floor that proves very little.** An L1 pass says the application does not have the failures a scanner would find. It says nothing about authorisation logic, key management, or business logic abuse, which is where the real findings almost always are. An L1-only review reported without that caveat is misleading even when every row is honestly ticked.
- **L3 is for applications where compromise is a safety or existential event.** Medical, industrial control, high-value financial settlement, systems where a breach ends the organisation or hurts someone physically. If the user asks for L3 on a marketing site, the correct response is to talk them down, not to bill the hours.

Level applies to the assessment, not to individual findings. A missing L3 control in an application you agreed to assess at L2 is not a finding; it is out of scope, and it belongs in the scope statement from step 0, not in the findings tree.

## Review procedure

1. **Pick a level, first, and say it out loud.** Ask what the application holds and what a compromise costs. Default to L2. Record the level and the one-sentence reason in the scope statement. If the user pushes for L1 to make the review cheaper, tell them what L1 does not prove, then let them decide. Their call, your record.

2. **Confirm the targeted passes are done.** This file runs last, after the doctrine order in `SKILL.md` section 3. Running it first produces a filled table and an unreviewed application, which is the exact failure this file is supposed to prevent.

3. **Mark scope per chapter before filling rows.** Walk the chapter list and decide which chapters the application actually has a surface for. An application with no file upload path has no File Handling surface, and every row in that chapter is `N/A` with the reason "no upload or file-read path; see inventory". Decide this from the step 1 inventory, not from memory.

4. **Fill each row from the targeted pass that already covered it.** Most rows should be answerable by pointing at work you already did. Cite the evidence the way the finding template does: path and the thing you read, not a claim.

5. **For every row no targeted pass covered, do the minimum read to settle it.** Minimum. If the read turns into an investigation, stop, note the area, and route it through `doctrine/06-investigation-playbook.md` rather than improvising a deep dive from inside a checklist.

6. **For every row you still cannot settle, mark it a gap.** Not a pass. Not `N/A`. A gap, named in `unverified.md`, so that the coverage metrics in `rubrics/scoring.md` section 4 reflect it honestly.

7. **Report coverage next to the score.** Chapters in scope, chapters worked, rows settled, rows marked gap. Adjacent to the number, always, per `rubrics/scoring.md` section 4.

---

## Checklist

Control IDs are local to this doctrine (`02.<chapter>.<n>`). The `ASVS ref` column cites ASVS 5.0 at section granularity, which is deliberate: section refs survive the point-release renumbering that individual requirement IDs do not. Evidence and Verdict ship blank on every row. Verdict is one of `Pass`, `Fail`, `Gap`, or `N/A`.

### Encoding and Sanitization (V1)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.encoding.1 | Output is encoded contextually at the point of use (HTML body, attribute, JS, URL, CSS), not once at input | V1.1 | | |
| 02.encoding.2 | The templating engine's auto-escaping is on, and every place it is bypassed (raw, safe, unescaped markers) is enumerated and justified | V1.1 | | |
| 02.encoding.3 | Untrusted data is never concatenated into a SQL, NoSQL, LDAP, XPath, or ORM raw fragment; parameterisation is used throughout | V1.2 | | |
| 02.encoding.4 | Untrusted data never reaches an OS command, shell, or process spawn without argument-array invocation and an allowlist | V1.2 | | |
| 02.encoding.5 | HTML sanitisation, where user-supplied markup is genuinely required, uses a maintained library with a documented allowlist, not a regex | V1.3 | | |
| 02.encoding.6 | Untrusted data is not passed to dynamic evaluation (`eval`, deserialisation of arbitrary types, template compilation from user input) | V1.2, V1.5 | | |
| 02.encoding.7 | Deserialisation of untrusted input is either absent, or type-constrained to a fixed allowlist | V1.5 | | |
| 02.encoding.8 | Redirect and forward targets derived from user input are validated against an allowlist, not merely prefix-checked | V1.4 | | |
| 02.encoding.9 | Untrusted input used in file paths cannot traverse (canonicalise then verify containment, after resolution, not before) | V1.4 | | |
| 02.encoding.10 | Server-side requests built from user-controllable URLs are allowlisted by host, and internal address ranges plus redirect chains are refused | V1.4 | | |

### Validation and Business Logic (V2)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.validation.1 | Input validation is server-side; client-side validation is treated as a usability feature with no security value | V2.1 | | |
| 02.validation.2 | Validation is positive (allowlist: type, length, range, format), not a denylist of known-bad strings | V2.2 | | |
| 02.validation.3 | Structured input is validated against a schema before any field is read, and unexpected fields are rejected or dropped, never bound blindly | V2.2 | | |
| 02.validation.4 | Mass assignment is prevented: request bodies cannot set fields the caller is not permitted to set (roles, ownership, pricing, status) | V2.2 | | |
| 02.validation.5 | Business logic flows enforce sequence: steps cannot be skipped, replayed, or reordered by calling the endpoints directly | V2.3 | | |
| 02.validation.6 | Business limits are enforced server-side (quantity, value, frequency, quota), not merely presented in the interface | V2.3 | | |
| 02.validation.7 | State transitions that must be atomic are actually atomic, and the concurrency control is present rather than assumed | V2.3 | | |
| 02.validation.8 | Anti-automation exists on the flows worth automating against, and it is not defeated by starting a new session | V2.4 | | |

### Web Frontend Security (V3)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.frontend.1 | A Content Security Policy is served, is restrictive on `script-src`, and does not rely on `unsafe-inline` or a wildcard host | V3.4 | | |
| 02.frontend.2 | State-changing requests are protected against cross-site request forgery by token, by `SameSite` cookie policy, or by a verified origin check | V3.5 | | |
| 02.frontend.3 | `X-Content-Type-Options: nosniff` is set, and responses carry an accurate `Content-Type` | V3.4 | | |
| 02.frontend.4 | Framing is controlled by CSP `frame-ancestors`, and legacy `X-Frame-Options` is consistent with it where present | V3.4 | | |
| 02.frontend.5 | `Referrer-Policy` prevents leaking URLs (which carry identifiers) to third parties | V3.4 | | |
| 02.frontend.6 | Cross-origin resource sharing does not reflect an arbitrary `Origin`, and `Allow-Credentials` is never combined with a wildcard or reflected origin | V3.4 | | |
| 02.frontend.7 | `postMessage` handlers verify `origin`, and no handler trusts a message by shape alone | V3.3 | | |
| 02.frontend.8 | Client-side sinks (`innerHTML`, `document.write`, framework raw-HTML props, dynamic script URLs) are not reachable from user-controllable sources | V3.3 | | |
| 02.frontend.9 | Sensitive data is not stored in browser local or session storage where any script on the origin can read it | V3.2 | | |
| 02.frontend.10 | Third-party scripts are enumerated, and each one is either integrity-pinned or consciously accepted as a full-origin trust grant | V3.4 | | |

### API and Web Service (V4)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.api.1 | Every endpoint is enumerated, including undocumented, legacy, debug, and versioned duplicates | V4.1 | | |
| 02.api.2 | Authentication and authorisation are enforced per endpoint, not by a route prefix convention that a new route can silently miss | V4.1 | | |
| 02.api.3 | HTTP method handling is explicit; an endpoint does not accept a method its authorisation logic did not anticipate | V4.1 | | |
| 02.api.4 | `Content-Type` is validated on request, and the parser selected is the one the handler expects | V4.2 | | |
| 02.api.5 | Responses return only the fields the caller needs; object serialisation does not leak internal fields by default | V4.2 | | |
| 02.api.6 | GraphQL, where present, constrains query depth, complexity, and batching, and introspection is off in production | V4.3 | | |
| 02.api.7 | Older API versions are either decommissioned or held to the same controls as the current one | V4.1 | | |
| 02.api.8 | Webhook receivers verify signatures and reject replays; webhook senders do not leak secrets in the payload or URL | V4.2 | | |

### File Handling (V5)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.file.1 | Upload type is validated by content inspection, not by extension or the client-supplied `Content-Type` | V5.1 | | |
| 02.file.2 | Stored filenames are generated server-side; the client-supplied name never reaches the filesystem path | V5.1 | | |
| 02.file.3 | Uploads are stored outside the web root, or in an object store configured so that stored content is never executed | V5.2 | | |
| 02.file.4 | Size limits are enforced before the file is buffered, and decompression is bounded against archive-expansion abuse | V5.1 | | |
| 02.file.5 | Files served back carry a safe `Content-Type`, `nosniff`, and a disposition that prevents inline execution of user content on a trusted origin | V5.2 | | |
| 02.file.6 | Download and file-read endpoints authorise the requester against the specific file, not merely against being logged in | V5.2 | | |
| 02.file.7 | Parsers applied to uploaded content (image, document, archive, XML) are constrained, and XML parsing has external entity resolution disabled | V5.3 | | |

### Authentication (V6)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.authn.1 | Passwords are stored with a memory-hard or otherwise approved algorithm (Argon2, scrypt, bcrypt, PBKDF2) at defensible parameters, salted per user | V6.2 | | |
| 02.authn.2 | Password policy enforces length over composition, and rejects known-breached passwords rather than mandating rotation | V6.1 | | |
| 02.authn.3 | Credential comparison is constant-time, and the failure response does not distinguish unknown user from wrong password | V6.2 | | |
| 02.authn.4 | Authentication is rate-limited and lockout-protected in a store that survives a new session and a new source address | V6.3 | | |
| 02.authn.5 | Multi-factor authentication, where present, cannot be skipped by requesting a post-authentication route directly | V6.4 | | |
| 02.authn.6 | Multi-factor secrets are stored encrypted, not in plaintext, and are not readable from a routine database dump | V6.4 | | |
| 02.authn.7 | Password reset tokens are random, single-use, time-bounded, stored hashed, and invalidate on use and on password change | V6.5 | | |
| 02.authn.8 | Reset and enumeration surfaces return a uniform response regardless of whether the account exists | V6.5 | | |
| 02.authn.9 | Credentials are never logged, never placed in a URL, and never returned in a response body | V6.2 | | |
| 02.authn.10 | Service and machine identities authenticate with something other than a long-lived shared secret in configuration, where the platform allows it | V6.6 | | |

### Session Management (V7)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.session.1 | Session identifiers are generated by a cryptographically secure source with sufficient entropy, and are never derived from user data | V7.1 | | |
| 02.session.2 | The session identifier is regenerated on privilege change, specifically at login, to prevent fixation | V7.2 | | |
| 02.session.3 | Session cookies carry `HttpOnly`, `Secure`, an appropriate `SameSite`, and the narrowest workable `Path` and `Domain` | V7.3 | | |
| 02.session.4 | Idle and absolute session timeouts exist and are enforced server-side, not by a client-side timer | V7.2 | | |
| 02.session.5 | Logout invalidates server-side session state; clearing the cookie alone is not logout | V7.2 | | |
| 02.session.6 | A password change or credential reset terminates the user's other active sessions | V7.2 | | |
| 02.session.7 | Session state is not stored client-side in a form the client can modify without detection | V7.1 | | |

### Self-contained Tokens (V8)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.token.1 | Token signature is verified on every use, with the algorithm fixed server-side, and `none` plus algorithm substitution are refused | V8.1 | | |
| 02.token.2 | Issuer, audience, expiry, and not-before are all validated, not merely present | V8.1 | | |
| 02.token.3 | Signing keys are resolved from a trusted, pinned source; a key identifier or key URL inside the token does not select the key unchecked | V8.2 | | |
| 02.token.4 | Token lifetime is short, and there is a revocation path for the case where short is not short enough | V8.2 | | |
| 02.token.5 | Tokens do not carry sensitive data in the payload on the assumption that encoding is concealment | V8.1 | | |
| 02.token.6 | Claims that drive authorisation are validated server-side against current state, not trusted because they are signed | V8.1 | | |

### Authorization (V9)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.authz.1 | Every object access verifies that the authenticated principal owns or is entitled to that specific object | V9.1 | | |
| 02.authz.2 | Authorisation is enforced server-side at the data access layer or at a chokepoint, not by hiding the control in the interface | V9.1 | | |
| 02.authz.3 | The default is deny: a new route or handler without an explicit rule is refused, not allowed | V9.2 | | |
| 02.authz.4 | Function-level authorisation distinguishes roles, and an administrative function is not reachable by a non-administrative principal who knows the path | V9.2 | | |
| 02.authz.5 | Tenant or organisation scoping is applied in the query, not filtered after retrieval | V9.1 | | |
| 02.authz.6 | Identifiers supplied by the client are treated as claims to be authorised, never as authority in themselves | V9.1 | | |
| 02.authz.7 | Field-level and operation-level authorisation exist where a single object has fields only some principals may read or write | V9.3 | | |

### Communication (V10)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.comms.1 | All traffic is TLS; plaintext HTTP either does not listen or redirects unconditionally before any content is served | V10.1 | | |
| 02.comms.2 | TLS configuration disables obsolete protocol versions and cipher suites | V10.1 | | |
| 02.comms.3 | HSTS is served with a defensible max-age, and the implications of `includeSubDomains` and preload are understood before either is set | V10.1 | | |
| 02.comms.4 | Outbound connections to internal and third-party services verify certificates; verification is not disabled anywhere, including in test configuration that ships | V10.2 | | |
| 02.comms.5 | Internal service-to-service traffic is encrypted, or the network boundary that makes it acceptable is real and named | V10.2 | | |

### Cryptography (V11)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.crypto.1 | Only vetted algorithms and library implementations are used; there is no bespoke cryptographic construction | V11.1 | | |
| 02.crypto.2 | Symmetric encryption is authenticated (AEAD), or the encrypt-then-MAC construction is explicit and correct | V11.2 | | |
| 02.crypto.3 | Initialisation vectors and nonces are unique per operation and never reused under the same key | V11.2 | | |
| 02.crypto.4 | Random values used for security purposes come from a cryptographically secure generator, not a general-purpose one | V11.3 | | |
| 02.crypto.5 | Keys are separated by purpose, and no key does double duty across encryption, signing, and session handling | V11.4 | | |
| 02.crypto.6 | Keys are stored outside the repository and outside application configuration in plaintext, and there is a rotation path that has been thought through | V11.4 | | |
| 02.crypto.7 | Hashing choice matches purpose: password hashing is not a fast hash, and integrity hashing is not a password KDF | V11.1 | | |

### Secure Coding and Architecture (V12)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.arch.1 | Trust boundaries are identified in the design, and validation happens at each crossing rather than once at the perimeter | V12.1 | | |
| 02.arch.2 | The application runs with least privilege: its process user, its data access role, and its cloud identity are each narrower than "everything" | V12.2 | | |
| 02.arch.3 | Security controls are centralised and reused; there is not a per-handler reimplementation of the same check | V12.1 | | |
| 02.arch.4 | Dependencies are inventoried with a lockfile, and known-vulnerable versions are identified rather than assumed absent | V12.3 | | |
| 02.arch.5 | Untrusted code paths (plugins, user-supplied templates, dynamic imports) are absent or sandboxed | V12.2 | | |
| 02.arch.6 | Memory-safety-sensitive code, where the language permits it, bounds every buffer and validates every length taken from input | V12.4 | | |

### Configuration (V13)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.config.1 | Secrets are not committed to the repository, and history has been checked rather than only the working tree | V13.1 | | |
| 02.config.2 | Production configuration disables debug mode, verbose errors, stack traces, and development-only endpoints | V13.2 | | |
| 02.config.3 | Default credentials, sample accounts, and seeded test users do not exist in production | V13.2 | | |
| 02.config.4 | Administrative and diagnostic interfaces are not exposed to the untrusted network | V13.2 | | |
| 02.config.5 | The build does not ship source maps, `.git` directories, backup files, or dependency manifests to the public root | V13.3 | | |
| 02.config.6 | Security-relevant configuration is set explicitly rather than inherited from a framework default that may change | V13.1 | | |
| 02.config.7 | Cloud and object storage permissions are least-privilege, and no bucket or container is public unless it is intended to be | V13.3 | | |

### Data Protection (V14)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.data.1 | Sensitive and personal data are classified, and the classification drives where each field may be stored and logged | V14.1 | | |
| 02.data.2 | Sensitive data at rest is encrypted, and the key is not stored adjacent to the data it protects | V14.2 | | |
| 02.data.3 | Responses containing sensitive data set caching headers that prevent storage by intermediaries and the browser | V14.3 | | |
| 02.data.4 | Sensitive data does not appear in URLs, referrers, logs, error reports, or third-party analytics payloads | V14.3 | | |
| 02.data.5 | Retention is bounded, and there is a deletion path that reaches backups, exports, caches, and downstream copies | V14.1 | | |
| 02.data.6 | Data exports and reports enforce the same authorisation as the interactive views they draw from | V14.2 | | |

### Security Logging and Error Handling (V15)

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.log.1 | Security-relevant events are logged: authentication success and failure, authorisation failure, privilege change, credential change, and administrative action | V15.1 | | |
| 02.log.2 | Log entries carry enough context to reconstruct an incident: timestamp with timezone, principal, source, action, and outcome | V15.1 | | |
| 02.log.3 | Logs do not contain credentials, tokens, session identifiers, or unnecessary personal data | V15.2 | | |
| 02.log.4 | Untrusted input written to logs cannot forge entries or inject terminators, and cannot execute when the log is rendered in a viewer | V15.2 | | |
| 02.log.5 | Logs are protected from modification and deletion by the application identity that writes them | V15.3 | | |
| 02.log.6 | Errors return a generic message to the client while the detail goes to the log; stack traces never reach a response body | V15.4 | | |
| 02.log.7 | Failure is closed: an exception in a security control denies the request rather than falling through to allow | V15.4 | | |
| 02.log.8 | The audit tables or log sinks that exist are actually written to; a schema without call sites is not logging | V15.1 | | |

### WebRTC (V16)

Applicable only where the application carries real-time peer-to-peer media. Where it does not, mark the chapter `N/A` with the reason and move on.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.webrtc.1 | Media and data channels use the mandated encryption (DTLS-SRTP), and no configuration path disables it | V16.1 | | |
| 02.webrtc.2 | The signalling channel is authenticated and authorised; joining a session requires entitlement to that session | V16.2 | | |
| 02.webrtc.3 | TURN and STUN credentials are short-lived and issued per session, not shared static values in client code | V16.2 | | |
| 02.webrtc.4 | The signalling and relay infrastructure is rate-limited and cannot be used as an amplification or relay-abuse surface | V16.3 | | |

### OAuth 2.0 and OIDC

ASVS 5.0 carries substantial OAuth and OIDC material. Whether it sits in its own chapter or is distributed across the authentication, token, and authorization chapters depends on the release you are working against. Treat the chapter number as unresolved and cite by name. The controls hold regardless of where they live.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 02.oauth.1 | The authorization code flow with PKCE is used; implicit flow and password grant are absent | OAuth and OIDC chapter | | |
| 02.oauth.2 | `redirect_uri` is matched exactly against a registered value, not by prefix, wildcard, or substring | OAuth and OIDC chapter | | |
| 02.oauth.3 | `state` is generated per request, bound to the session, and verified on return | OAuth and OIDC chapter | | |
| 02.oauth.4 | The ID token is validated in full (signature, issuer, audience, nonce, expiry) before any claim in it is trusted | OAuth and OIDC chapter | | |
| 02.oauth.5 | Scopes are least-privilege, and the resource server enforces scope rather than assuming the authorization server did | OAuth and OIDC chapter | | |
| 02.oauth.6 | Refresh tokens are stored encrypted, rotated on use, and revocable | OAuth and OIDC chapter | | |
| 02.oauth.7 | Client secrets are not present in any public client, including single-page and mobile applications | OAuth and OIDC chapter | | |

---

## Coverage, not investigation

Ticking every row is not a review. The checklist proves you looked at each area. It does not prove you found what was there, and it cannot: a row is a prompt, not a method. `doctrine/06-investigation-playbook.md` is where the actual finding happens, and if this file is the only pass you ran, the review is a table, not an audit.

A completed checklist with no findings means one of two things: a clean application, or a lazy reviewer. Those are indistinguishable from the table alone, and the report must make clear which it is. The instrument for that is the coverage metrics in `rubrics/scoring.md` section 4. Report entry points enumerated against entry points traced, doctrine passes completed against the applicable set, and every area named in `unverified.md`. A clean checklist at 90 percent traced coverage is a genuine result worth reporting. A clean checklist at 15 percent is an unfinished review, and reporting the first number without the second manufactures a conclusion the evidence does not support.

Do not resolve a row by reading the row. Resolve it by citing the work that settled it, under Rule 3, in the same turn. "No SQL injection found" is not evidence. The grep you ran and the query construction you read is evidence.

## Not applicable is a verdict

`N/A` is a legitimate Verdict value. An application with no upload path has no file handling controls to verify, and forcing a Pass onto those rows is worse than honest omission because it claims a control that does not exist.

`N/A` requires a reason in the Evidence column. Not a shrug, a reason: what makes the chapter inapplicable, and what you read to establish that. "No file upload path; no multipart handler and no filesystem write in the entry point inventory" is a reason. "N/A" alone is an unfilled row wearing a disguise, and it is the single easiest way to fake coverage on this file, which is exactly why it gets its own section.

The reason also carries a shelf life. `N/A` because the application has no upload path is true until someone adds one. Where the reason is a fact about the current build rather than about the design, say so, because that is what makes the next review cheap instead of a restart.

Three failure modes to watch for in your own table:

| Looks like | Actually is | Tell |
|---|---|---|
| `N/A` on a whole chapter | The reviewer did not want to work the chapter | No reason, or a reason that is the chapter name restated |
| `Pass` with evidence that is a file path and nothing else | An assertion, not a verification | You cannot tell from the evidence what was read or what it said |
| `Gap` used for anything inconvenient | Findings laundered into coverage debt | A gap is an area unreviewed. A control read and found missing is a Fail, and it belongs in the findings tree |

## Alignment is not certification

Working this checklist produces an **ASVS-aligned review**. It does not produce an **ASVS certification**, and the report must not imply, hint, or allow a reader to infer otherwise. No badge, no "ASVS L2 certified", no "meets ASVS", no compliance language. Write "reviewed against ASVS 5.0 at Level 2" and nothing stronger.

Certification under ASVS is a formal process performed by an independent verifier against the full requirement set, with testing that goes well beyond a read-only code review. This skill does not execute the target, does not send it traffic, and does not test it (`SKILL.md` section 9). A read-only review cannot certify anything, and a report that suggests it can has caused a security failure of its own: it converts an honest partial result into false assurance, and false assurance travels further and lasts longer than the review did.

## Notes on severity

Rows in this file do not carry severity. Findings do. A `Fail` here is a candidate finding: write it up per `doctrine/07-findings-template.md`, verify it end to end under Rule 2, and score it under `rubrics/scoring.md` like anything else. A control missing from a checklist is not automatically a finding, because the matrix is impact multiplied by reachability, and "ASVS says so" is neither.

Two traps specific to a backstop pass:

A checklist row's importance in ASVS says nothing about its severity in this application. A control in the L1 baseline is not therefore a High. The verification ceiling applies here exactly as it does everywhere: a `Fail` you noted from a checklist sweep but did not trace is `verified: false` and holds at Info, no matter how bad the pattern looks. That ceiling will cost you findings on this pass in particular, because a wide pass produces exactly the kind of untraced pattern-match the ceiling exists to catch.

Gaps are not findings either. An area you did not review is not a vulnerability, and inventing an Info-level finding to account for it corrupts the count. It goes in `unverified.md` and into the coverage metrics, where a reader can see it and point a human at it.
