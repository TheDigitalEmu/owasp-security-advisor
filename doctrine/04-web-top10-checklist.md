# 04. Web Top 10 (2025) Checklist

**Doctrine ID:** `04-web-top10-checklist`
**Mode:** review
**Source standards:** OWASP Top 10 (2025), categories A01 to A10

---

## Purpose

This doctrine runs the ten 2025 Top 10 categories over `<target-repo>` as a
cross-check on work you have already done. It fires after the auth and database
passes, not before. It exists to catch a category you skipped entirely, and it
is not the shape of the review.

## What changed from 2021, and why it matters to you

The 2025 edition (final in January 2026) is not a cosmetic renumber. If you
learned this list as the 2021 version, the following will trip you up:

- **Two new categories.** A03 Software Supply Chain Failures (an expansion of
  the old Vulnerable and Outdated Components into the whole build and dependency
  chain) and A10 Mishandling of Exceptional Conditions (entirely new: what the
  code does when something goes wrong).
- **SSRF is gone as its own entry.** Server-Side Request Forgery folded into
  A01 Broken Access Control. It is still a defect you look for; it is filed
  under A01 now.
- **Renames.** A07 is now Authentication Failures (was Identification and
  Authentication Failures). A09 is now Security Logging and Alerting Failures
  (was Monitoring).
- **Re-rankings.** Security Misconfiguration rose to A02. Cryptographic Failures
  dropped to A04. Injection dropped to A05. Insecure Design dropped to A06.

The category number is filing, not severity, so a re-ranking changes nothing
about how you score. It matters only so your citations are correct: an
`A03:2025` that means the 2021 injection category is a Rule 3 error a reader
will catch.

## Principles

1. **The Top 10 is a cross-check, not a plan.** If this file is the first thing
   you open, you are organising a review around a list that was never designed
   to be one. Run `doctrine/06-investigation-playbook.md` first.
2. **Cover all ten or say which you did not.** A pass that quietly skips A04
   and A09 because they had no grep pattern is not a pass. Naming an uncovered
   category is honest; omitting it is not.
3. **A category is not a finding.** "This app has A05" is not something you can
   put in a report. A finding is a traced path from a named entry point to a
   named sink. The category is filing, applied afterwards.
4. **Search by idiom, not by filename.** File naming is a convention the target
   may not follow. Sink shapes are forced by the language and the libraries,
   so they are what you can actually search for.
5. **Do not duplicate the deep doctrine.** Where a category has its own file,
   this checklist confirms coverage and points there. The detail lives in one
   place and it is not this one.

## Review procedure

1. Confirm the inventory from step 1 of the skill procedure exists. Without an
   entry point list, several of these categories cannot be checked at all, only
   guessed at.
2. Work A01 to A10 in order. Do not reorder to do the easy ones first.
3. For each category, run the search strategy, then read what it returns. A hit
   count is not a result.
4. For every candidate, apply Rule 2 before it gets a severity above Info.
5. Where a row points at deeper doctrine, run that doctrine and record the
   verdict here by reference. Do not re-derive it.
6. Record categories you could not check, and why, in `unverified.md`.

---

## The Top 10 is a category list, not a test plan

The Top 10 is an awareness document. Its categories are aggregated from
real-world breach and scanner data, then bucketed by a committee. That process
produces a list that is excellent at telling you what commonly goes wrong across
the whole industry, and structurally incapable of telling you what is wrong with
one specific application.

A review organised solely around these ten buckets misses anything that does not
fit a bucket. Business logic that lets a user apply the same one-time credit
forever is not any of the ten. A tenancy model that leaks between customers on a
background job is arguably A01, but you will never find it by looking for A01,
because you find it by understanding the tenancy model. The categories are also
uneven: A05 is a sink shape you can grep for, A06 is an entire discipline.

Use this file as the cross-check. `doctrine/02-asvs-checklist.md` is the
coverage backstop, because it is a control list rather than a category list and
it does not pretend that ten buckets are exhaustive.
`doctrine/06-investigation-playbook.md` is the method. Order matters: method
first, coverage backstop last, this file in the middle to catch the gaps.

---

### A01: Broken Access Control

The application knows who you are and fails to constrain what you may touch.
In practice this is almost never a missing login page; it is a handler that
authenticates the caller and then trusts a client-supplied identifier to select
the record, or a role check applied to the page and not to the endpoint behind
it. It sits at number one because it is the default outcome of building
features one at a time and adding authorization per handler by hand. In 2025
this category also absorbs Server-Side Request Forgery: an attacker who steers
where the server sends a request is bypassing the network's access controls, so
SSRF is filed here now (rows 04.1.9 to 04.1.13 below).

**Search strategy (by idiom):** find every handler that reads an identifier out
of the request (path parameter, query string, body field, header) and uses it in
a lookup. For each, read the path from the route registration through every
middleware and decorator to the lookup, and ask what ties that identifier to the
caller's identity. Look for the inverse too: lookups keyed by identity alone are
usually safe, so the set you care about is the difference. Also grep for
authorization helper names and then read every call site, including the ones
that only call it in one branch. For the SSRF rows, find every outbound HTTP
client construction and trace the URL argument backwards. Deeper doctrine:
`doctrine/13-auth-and-session.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.1.1 | Every handler taking a client-supplied object identifier checks that the caller may access that object | V4.2 | | |
| 04.1.2 | Access control is enforced server side on the endpoint, not only in the UI that renders the link | V4.1 | | |
| 04.1.3 | Default is deny: an unrecognised route or an unhandled role falls closed | V4.1 | | |
| 04.1.4 | Privilege and role are read from server-side session or token state, never from a request field | V4.1 | | |
| 04.1.5 | Administrative endpoints carry their own authorization independent of path obscurity | V4.3 | | |
| 04.1.6 | Direct object references in file paths, exports, and download endpoints are authorized | V4.2 | | |
| 04.1.7 | Tenancy or ownership scoping is applied in background jobs and scheduled tasks, not only in request handlers | V4.2 | | |
| 04.1.8 | CORS policy does not reflect arbitrary origins or pair a wildcard with credentials | V14.5 | | |
| 04.1.9 | Every outbound fetch whose URL is client-influenced is enumerated (SSRF) | V12.6 | | |
| 04.1.10 | SSRF destinations are allowlisted by host, not filtered by a deny-list | V12.6 | | |
| 04.1.11 | Redirects on outbound fetches are not followed, or the destination is re-validated after each hop | V12.6 | | |
| 04.1.12 | Requests to loopback, link-local, and private ranges are blocked after DNS resolution | V12.6 | | |
| 04.1.13 | The fetching component holds no ambient credentials the destination could capture, and metadata endpoints are unreachable | V12.6 | | |

---

### A02: Security Misconfiguration

The software is capable of being secure and is not configured that way. Debug
mode reachable in production, a default credential never changed, stack traces
returned to the caller, an overly permissive bucket or share, framework
features enabled that nothing uses, security headers absent. It rose to number
two in 2025 as configuration surface grew with cloud-native deployment. It is
the category most likely to be invisible in a pure code read, because the truth
lives in deployment state rather than in the tree.

**Search strategy (by idiom):** find the configuration loading path and read
what it defaults to when a value is absent, because absent is the state that
ships by accident. Find the error handling boundary and read what it returns to
the caller versus what it logs. Find every flag whose name suggests development,
debug, verbose, or test, and trace how it is set at runtime. Read the
infrastructure and container definitions as code. Deeper doctrine on the
configuration and secret surface: `doctrine/08-secrets-and-config.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.2.1 | Debug and verbose modes cannot be enabled in production by a request-controlled value | V14.1 | | |
| 04.2.2 | Error responses to clients carry no stack trace, framework version, or query text | V7.4 | | |
| 04.2.3 | Configuration defaults to the secure value when a setting is missing | V14.1 | | |
| 04.2.4 | No default or example credentials remain in any configuration path | V14.1 | | |
| 04.2.5 | Security headers are set and their values were read, not assumed from a library name | V14.4 | | |
| 04.2.6 | Unused framework features, sample content, and admin consoles are not deployed | V14.2 | | |
| 04.2.7 | Directory listing and source disclosure are disabled on every served path | V14.3 | | |
| 04.2.8 | Cloud storage and object store permissions are declared in code and are not public by default | V14.1 | | |

---

### A03: Software Supply Chain Failures

You are exposed through something you did not write and cannot fully see: a
dependency with a known defect, a build step that fetches a mutable artifact, a
package pulled from a registry with no integrity check, a compromised or
typosquatted transitive. New for 2025 as its own top-level category, expanding
the old Vulnerable and Outdated Components to cover the whole chain from the
registry to the running artifact. It matters because the dependency and the
pipeline run with your application's full privilege, and because exploitation is
cheap once an advisory is public.

**Search strategy (by idiom):** read the lockfiles, not the manifests. The
manifest states an intention (a range), the lockfile states what actually
resolves, and only the second one is truth under Rule 3. Enumerate transitive
depth, because the risk is rarely in what you chose directly. Read the pipeline
definition as an attack surface: what it fetches, what secrets it holds, whether
steps are pinned to immutable references. Confirm whether an install today would
produce the same tree. Deeper doctrine:
`doctrine/09-dependency-supply-chain.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.3.1 | A lockfile exists for every ecosystem and is committed | V14.2 | | |
| 04.3.2 | The full dependency tree, including transitives, is enumerable | V14.2 | | |
| 04.3.3 | Known-vulnerable versions are identified against the resolved tree, not the declared ranges | V14.2 | | |
| 04.3.4 | Dependencies resolve from verified sources with integrity hashes recorded | V14.2 | | |
| 04.3.5 | Build pipeline steps are pinned to immutable references, not mutable tags | V14.2 | | |
| 04.3.6 | Components no longer maintained upstream are identified as such | V14.2 | | |
| 04.3.7 | Client-side libraries served to browsers are inventoried alongside server dependencies | V14.2 | | |
| 04.3.8 | Base images and runtime versions are pinned and current | V14.2 | | |

---

### A04: Cryptographic Failures

Data that needed protection did not get it, or got something that looks like
protection and is not. The failure is usually a bad choice of primitive or mode
rather than an absence of crypto. Home-rolled encryption, ECB, a static IV, a
password hashed with a fast general-purpose digest, or TLS terminated somewhere
and then carried onward in plaintext.

**Search strategy (by idiom):** find the cipher construction calls and read the
mode and the IV or nonce source. Find the hashing calls and separate the
password ones from the checksum ones, because the correct answer differs.
Find every random value that has a security purpose and check whether the
generator is the cryptographic one for that language or the fast one. Find key
material and follow it back to where it is loaded from. Then invert it: list
the fields you classified as sensitive in the inventory and confirm each has a
protection story at rest and in transit.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.4.1 | Passwords are stored with a memory-hard function (Argon2id, scrypt, bcrypt) with parameters read and confirmed | V2.4 | | |
| 04.4.2 | No home-rolled cipher construction; authenticated encryption is used where confidentiality is needed | V6.2 | | |
| 04.4.3 | IV or nonce is unique per operation and not a constant read from configuration | V6.2 | | |
| 04.4.4 | Security-relevant random values use a cryptographic generator, not the language default | V6.3 | | |
| 04.4.5 | TLS is enforced on every hop, including internal service calls and callbacks | V9.1 | | |
| 04.4.6 | Keys are separated from the data they protect and are rotatable | V6.4 | | |
| 04.4.7 | Sensitive fields are not cached, logged, or included in error responses | V8.1 | | |
| 04.4.8 | Deprecated primitives (MD5, SHA-1, DES, RC4) are absent from security paths | V6.2 | | |

---

### A05: Injection

Untrusted input is interpolated into something that is then parsed by an
interpreter. SQL is the famous case, but the same defect covers OS commands,
LDAP filters, template engines, expression languages, XPath, and NoSQL query
objects. Cross-site scripting lives in this category too: it is the same defect
against a different interpreter, the browser. The fix is never escaping alone;
it is a parser that keeps code and data in separate channels.

**Search strategy (by idiom):** find the string-building idioms of the language,
concatenation, interpolated literals, format calls, and see which ones end at
an interpreter boundary. Follow the argument backwards to an entry point, not
forwards from the entry point, because there are fewer sinks than sources.
Read every query-building helper the codebase wrote for itself: a wrapper named
for safety is a claim, not evidence, and Rule 2 says you open it. For the browser
interpreter, find the sinks that write markup rather than text, and the template
constructs that suppress auto-escaping. Deeper doctrine:
`doctrine/15-database-access.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.5.1 | All queries use parameter binding; no user data reaches a query string by concatenation | V5.3 | | |
| 04.5.2 | Identifiers that cannot be bound (table, column, sort direction) are allowlisted against a fixed set | V5.3 | | |
| 04.5.3 | Every self-written query helper has been opened and read, not trusted by name | V5.3 | | |
| 04.5.4 | OS command execution passes arguments as a vector, never a shell string | V5.3 | | |
| 04.5.5 | Output encoding is contextual and applied at the sink, not at the input boundary | V5.3 | | |
| 04.5.6 | Auto-escaping is not disabled in templates, or every exception is justified and reviewed | V5.3 | | |
| 04.5.7 | User input does not reach a template compiler, expression evaluator, or deserializer | V5.5 | | |
| 04.5.8 | Input validation exists as defence in depth but is not the primary control against injection | V5.1 | | |

---

### A06: Insecure Design

The code correctly implements a design that was wrong. There is no bug in any
line; the flaw is in what the system permits. A password reset that reveals
whether an account exists, a refund flow with no upper bound, a workflow whose
steps can be completed out of order, a trust assumption that holds until one
component is compromised. This category says plainly that some things cannot be
fixed by writing the same feature more carefully.

**Search strategy: there is not one.** Insecure Design cannot be found by grep,
at all. There is no idiom, no sink shape, no import to look for. It is found by
comparing what the system permits against the threat model from step 2 of the
skill procedure, feature by feature, asking what an adversary who follows every
rule could still achieve. If you skipped the threat model, you cannot run this
category, and you should say so in `unverified.md` rather than mark it clean.

This is the category reviewers skip, and they skip it precisely because it has
no search pattern. A pass that reports nine categories examined and A06 silently
absent is the normal failure, and it is the one worth naming out loud. The rows
below are checks against the design, so they need the threat model open beside
them.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.6.1 | A threat model exists for this review (step 2) and names assets, adversaries, and trust boundaries | V1.1 | | |
| 04.6.2 | Security-relevant flows have documented limits: attempts, amounts, rates, quantities | V1.1 | | |
| 04.6.3 | Multi-step flows enforce step order and cannot be resumed from an arbitrary step | V1.1 | | |
| 04.6.4 | Failure modes are closed: when a dependency is unavailable, the flow denies rather than proceeds | V1.1 | | |
| 04.6.5 | Trust boundaries are explicit and each one has a stated control, not an assumption | V1.1 | | |
| 04.6.6 | Recovery and support flows (reset, impersonation, override) are modelled as attack surface | V1.2 | | |
| 04.6.7 | Segregation of tenants or user data is a design property, not a per-query habit | V1.1 | | |

---

### A07: Authentication Failures

Proving who someone is, and keeping that proof valid only as long as it should
be. Renamed from Identification and Authentication Failures in 2025. The
failures cluster around the edges rather than the login form: session
identifiers that survive a privilege change, reset tokens that do not expire,
a second factor that can be skipped by calling the next endpoint directly,
credential stuffing with no rate limit, logout that clears a cookie and leaves
the server-side session live.

**Search strategy (by idiom):** find where a session or token is created and
every place it is destroyed, and compare the two lists. Find the privilege
transition points (login, step-up, role change, impersonation) and check whether
the session identifier is regenerated at each. Find the token verification call
and read what it accepts: algorithm, audience, issuer, expiry, and what happens
on each failure branch. Read the reset and recovery flow end to end; it is a
parallel authentication path and it is usually the weaker one. Deeper doctrine:
`doctrine/13-auth-and-session.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.7.1 | Session identifier is regenerated on every privilege change, including step-up | V3.2 | | |
| 04.7.2 | Logout invalidates server-side state, not only the client cookie | V3.3 | | |
| 04.7.3 | Session and token expiry are enforced server side and were read, not assumed | V3.3 | | |
| 04.7.4 | Token verification checks signature, algorithm, expiry, issuer, and audience | V3.5 | | |
| 04.7.5 | Authentication attempts are rate limited or throttled by a durable mechanism | V2.2 | | |
| 04.7.6 | Second factor cannot be bypassed by calling a post-authentication endpoint directly | V2.8 | | |
| 04.7.7 | Reset and recovery tokens are single use, expiring, and unguessable | V2.5 | | |
| 04.7.8 | Session cookies carry the correct flags and were read from the code that sets them | V3.4 | | |

---

### A08: Software or Data Integrity Failures

You trusted something you had no way to verify. Code, configuration, or data
arrives from somewhere and is used without any check that it is what it claims
to be. This includes deserializing untrusted input into objects, an update
mechanism with no signature check, and client-supplied state the server later
trusts. The dependency and pipeline aspects of integrity are covered under A03;
this category is the trust decisions inside the running application.

**Search strategy (by idiom):** find deserialization calls and see whether the
input can originate outside your trust boundary. Find where anything executable
is fetched at build or run time and read whether the artifact is verified. Find
client-supplied state (hidden fields, cookies, tokens) that the server later
treats as authoritative and check whether it is signed or held server side.
Deeper doctrine: `doctrine/09-dependency-supply-chain.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.8.1 | Untrusted input is never deserialized into arbitrary object types | V5.5 | | |
| 04.8.2 | Externally hosted scripts carry integrity attributes or are self-hosted | V14.2 | | |
| 04.8.3 | Client-supplied state that the server later trusts is signed or held server side | V5.5 | | |
| 04.8.4 | Auto-update or plugin loading paths verify a signature before execution | V14.2 | | |
| 04.8.5 | Serialized objects crossing a trust boundary carry an integrity check | V5.5 | | |

---

### A09: Security Logging and Alerting Failures

The attack happened and nobody could tell, or could tell but only afterwards
and only partially. Renamed from Monitoring to Alerting in 2025 to stress that a
log nobody is alerted on is not detection. This is the category with no exploit
and no proof of concept, which is why it is consistently under-reported: nothing
visibly breaks. It matters because every other category's worst case is much
worse when the detection window is measured in months, and because an audit
trail you cannot reconstruct is an incident you cannot scope.

**Search strategy (by idiom):** enumerate the security-relevant events (auth
success and failure, privilege change, access denied, data export, admin action)
and then find the write calls for each. The gap between the two lists is the
finding. Read what is logged for content, because a log line carrying a password
or a token is its own defect. Check whether the failure branch logs at all;
the common pattern is logging the happy path and swallowing the exception.
Deeper doctrine: `doctrine/10-logging-monitoring.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.9.1 | Authentication success and failure are logged with enough context to attribute them | V7.2 | | |
| 04.9.2 | Access control denials are logged, not silently returned | V7.2 | | |
| 04.9.3 | Privileged and administrative actions produce an audit record | V7.2 | | |
| 04.9.4 | Logs contain no credentials, tokens, or sensitive personal data | V7.1 | | |
| 04.9.5 | Log entries carry a timestamp, an actor, a source address, and an outcome | V7.1 | | |
| 04.9.6 | Logs are written somewhere the application cannot rewrite or delete | V7.3 | | |
| 04.9.7 | Untrusted input in a log line cannot forge a record boundary | V7.1 | | |
| 04.9.8 | Security-relevant events reach a place a human or an alert actually watches | V7.2 | | |

---

### A10: Mishandling of Exceptional Conditions

New for 2025. The application handles the error path badly, and the error path
is where security decisions quietly invert. A catch block that swallows a failed
authorization check and continues. A default branch that falls open instead of
closed. A timeout or a dependency outage that skips a control rather than
denying the request. A verbose error that leaks internals. The theme is that the
unhappy path was never designed, so it does whatever the language happens to do.

**Search strategy (by idiom):** find the broad exception handlers (catch-all,
bare except, error middleware) and read what each does on the security-relevant
paths, especially whether a caught failure still lets the request proceed. Find
every place a control depends on a call that can fail (an authorization service,
a token verifier, a policy fetch) and read the failure branch: does it deny, or
does it fall through. Find the default cases in permission and routing logic and
confirm the default is deny.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 04.10.1 | Exception handling fails closed: a caught error on a security path denies rather than proceeds | V7.4 | | |
| 04.10.2 | Default branches in authorization and routing deny rather than fall open | V4.1 | | |
| 04.10.3 | A failure in an external control (authz service, token verifier, policy fetch) denies the request | V1.1 | | |
| 04.10.4 | Errors are handled specifically, not swallowed by a broad catch that continues | V7.4 | | |
| 04.10.5 | Error responses to the caller carry no internal detail; the detail goes to the log | V7.4 | | |
| 04.10.6 | Timeouts and resource-exhaustion paths degrade to a denied state, not an unchecked one | V7.4 | | |

---

## Common false positives

| Looks like | Often is not | How to tell |
|---|---|---|
| Concatenated SQL | Safe, if every interpolated value is a literal or an allowlisted identifier | Trace each interpolation to its source. No entry point reaches it, no finding above Info under Rule 2 |
| Missing authorization on a handler | Present, in middleware registered at the router | Read the registration and confirm the ordering. Do not stop at the handler body |
| A fast hash on a password field | A checksum on a field that shares the name | Read the caller. Not everything called `hash` guards a credential |
| Missing security header | Set at the reverse proxy or edge | You usually cannot confirm this from the tree. That makes it unverified, not clean |
| Disabled auto-escaping | Correct, on a value the code constructed and never derived from input | Trace the value. If it is a literal or an already-encoded fragment, it is fine |
| An outbound fetch with a variable URL | Fixed, resolved from configuration you read | Follow the variable back. A config-sourced host is not SSRF |
| Deserialization call | Safe, if the input is trusted and the type is constrained | Read the reachability and the type binding, not just the call |
| Old dependency version | Not vulnerable, or vulnerable in a code path the app never calls | Check the advisory's affected range against the resolved version, and whether the path is reachable |
| A broad catch block | Fine, if it re-raises or denies on the security path | Read what happens after the catch. Continuing is the defect, catching is not |

The pattern across all of these: the search finds a shape, and the shape is not
the finding. Rule 2 exists because these are the ways a Top 10 pass generates
confident nonsense.

## Notes on severity

Category does not set severity. There is no rule that A01 findings are High and
A09 findings are Low, and reviewers who apply one produce reports that cannot be
compared to anything. Score impact and reachability independently and read the
matrix in `rubrics/scoring.md`.

Category-specific notes:

- **A06** (Insecure Design) findings frequently fail the verification ceiling
  honestly. A design flaw you inferred from the threat model but could not trace
  to a concrete reachable path is Info and unverified. Say what would lift it.
- **A09** findings are almost always Minor impact and therefore Low or Info on
  the matrix. That is the right answer, and it is worth saying in the report
  that the matrix is scoring the absence of detection rather than the presence
  of a breach.
- **A02** (Security Misconfiguration) findings about deployment state usually
  cannot be settled by code read alone. Under Rule 2 they land unverified at
  Info. That is the correct outcome, not a gap in the review. Record them in
  `unverified.md` with the question a human should answer.
- **A10** (Mishandling of Exceptional Conditions) severity comes from what the
  mishandled path controls. A swallowed authorization failure is as severe as a
  missing authorization check, because that is what it is. Score the sink, not
  the fact that it was reached through an error path.
