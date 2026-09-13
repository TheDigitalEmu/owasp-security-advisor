# 13. Authentication, Authorization and Session

**Doctrine ID:** `13-auth-and-session`
**Mode:** review and build
**Source standards:** ASVS 5.0 (authentication, session management,
self-contained tokens, and authorization chapters), OWASP Top 10 2025 A01
(Broken Access Control, which in 2025 also absorbs SSRF) and A07
(Authentication Failures, renamed from the 2021 Identification and
Authentication Failures),
OWASP Authentication Cheat Sheet, Session Management Cheat Sheet,
Authorization Cheat Sheet, JSON Web Token Cheat Sheet

---

## Purpose

This doctrine covers how a request becomes an identity, how that identity
persists, and what that identity is permitted to do. It fires on any review of
anything with a login, a token, a cookie, or a permission check.

This is the highest-yield doctrine in the set, and that is not a slogan. Broken
access control is the most commonly found and among the most severe classes of
defect in real reviews. If you have limited time, spend it here, and spend most
of it on authorization rather than authentication.

## Principles

1. **Authentication is who you are. Authorization is what you may do. Session is
   how the answer persists.** Most real defects are authorization. Most reviewers
   spend their time on authentication, because authentication is concentrated in
   a handful of files you can read in an hour, while authorization is smeared
   across every handler in the codebase. The time allocation is backwards on
   almost every review. Correct it deliberately; it will not correct itself.

2. **Deny by default, and prove it.** The safe architecture is one where a
   handler with no explicit authorization decision is unreachable. Ask which way
   the default falls in `<target-repo>` and answer from code. If a newly added
   handler with no annotation is public, every future handler is a candidate
   finding.

3. **The reset path is the authentication path.** Password reset, email change,
   and account recovery exist to let someone in without the password. They get a
   fraction of the design attention the login form gets. That is why the bugs
   live there. Review them harder than login, not less.

4. **A token you cannot revoke is a session you cannot end.** Statelessness is a
   performance decision with a security cost, and the cost lands at the worst
   moment: when you need to eject a compromised identity. If the answer to "the
   account is compromised, now what" is "wait for expiry", that is a finding.

5. **Client-supplied identity claims are input, not facts.** A role, tenant, user
   identifier, or permission set arriving in a body, query string, header, or
   client-writable cookie is attacker-controlled. Only claims the server derived
   itself, or verified against a key the client does not hold, count.

6. **"The middleware handles it" is a hypothesis.** It becomes evidence only once
   you have read the middleware registration ORDER and confirmed the handler is
   actually behind it (Rule 2). Middleware registered after the route, mounted on
   a different prefix, or short-circuited by an earlier handler protects nothing.

---

## Credential storage

The control is memory-hard password hashing with a per-user salt. Nothing else
here substitutes for it.

- **Acceptable:** Argon2id (preferred), scrypt, bcrypt as the floor. PBKDF2 only
  where a compliance regime forces it, then with a high iteration count.
- **Not acceptable:** any fast hash. A general-purpose digest applied to a
  password, with or without salt or iteration, is a finding. Speed is the
  vulnerability.
- **Per-user salt, stored with the hash.** Modern password hash functions
  generate and encode it for you. A hand-rolled salt scheme is a signal to read
  the whole implementation, because somebody decided they knew better.
- **Pepper theatre.** A pepper defeats offline cracking of a hash dump that did
  not also leak the application host. That is a narrow real benefit surrounded by
  ceremony. It does not rescue a fast hash. Do not file a missing pepper above
  Info. Do read where an existing pepper lives, because it is often in the same
  repository as the code.
- **Encryption instead of hashing** makes passwords recoverable in plaintext, by
  design, by anyone holding the key. Catastrophic impact, not a variation on
  hashing. The tell is a decrypt call near the login path, or a feature that
  emails a user their existing password.
- **Verification is constant-time**, using the library's verify function, not
  string equality.
- **Work factor is current and configurable**, and rehash-on-login exists so it
  can actually be raised.

Recovery codes, API keys, and long-lived tokens are credentials and inherit every
rule above. A recovery code stored in plaintext is a plaintext password with
better marketing.

---

## Authentication flows

Enumerate all of these and confirm each exists or is deliberately absent. The one
you forget to enumerate is the one that is broken.

| Flow | What to look for |
|---|---|
| Login | Credential verification, generic failure response, rate limiting, session issue |
| Logout | Server-side session destruction, not just a cookie clear |
| Registration | Enumeration on the "already registered" path, verification of contact ownership |
| Password reset request | Token entropy, single use, short expiry, bound to one account |
| Password reset consume | Token verified server-side, session rotation, invalidation of other sessions |
| Contact address change | Verification of the NEW address before it becomes an identity, notification to the OLD one |
| MFA enrolment | Requires re-authentication, secret shown once, confirmed by a successful challenge |
| MFA recovery | The bypass path. Rate limited, single use, treated as a credential |
| Step-up authentication | Whether the re-auth actually gates the action or merely decorates it |

The reset and recovery flows deserve specific hostility. Common defects, all
code-readable:

- Reset token generated from a non-cryptographic source, a timestamp, a counter,
  or a hash of the user identifier.
- Reset token not invalidated after use (a permanent backdoor), or not
  invalidated when a new one is requested.
- Reset token accepted alongside a user identifier supplied in the same request,
  so the token authenticates but does not bind. Present it with a different
  identifier and reset that account instead.
- Reset URL built from a client-supplied host header, or leaked via the referrer.
- Password changed without invalidating existing sessions, so the attacker who
  triggered the reset keeps their session after the victim recovers.
- Contact address change with no verification of the new address, converting an
  account takeover into a permanent one.
- MFA enrolment that does not require the current password, so a stolen session
  becomes a stolen account.

---

## Account enumeration

A response that distinguishes "no such account" from "wrong password" hands the
attacker a user list. Check both channels.

- **Differential responses.** Message text, status code, redirect target,
  response length, field-level validation errors, and the presence or absence of
  a rate-limit response. Registration and reset request paths leak this more
  often than login, because "we have sent you an email" feels safe to vary.
- **Differential timing.** If the code verifies the password only when the
  account exists, the miss path skips the hashing cost, and the difference is
  measurable across the network precisely because the hash is deliberately slow.
  The control is a dummy verification against a fixed hash on the miss path. Read
  for it. Its absence is real, but timing enumeration is far harder to exploit
  than a differential message, and severity should reflect that.

Enumeration alone is Minor to Moderate impact. It is a multiplier on credential
stuffing, so read it together with the rate limiting result rather than in
isolation.

---

## Brute force and credential stuffing

The control set is: rate limiting per account and per source, progressive delay
or lockout, breached-password rejection at registration and change, and detection
of the distributed low-and-slow pattern that per-source limits miss entirely.

Cross-reference `doctrine/17-rate-limit-abuse.md` for verifying the limiter
itself. The point that belongs here: a limiter keyed only on source address does
nothing against credential stuffing, which is by construction distributed. A
limiter keyed only on the account does nothing against password spraying, which
is by construction spread across accounts. You need both keys. Read which key is
actually used rather than accepting that a limiter exists.

State held only in the process, or only in the session the attacker controls, is
not a limiter. A counter in the session is reset by discarding the session.

---

## Multi-factor authentication

- **WebAuthn / FIDO2** is the strong option and is phishing-resistant because the
  assertion is bound to the origin. Prefer it. Verify the relying party
  identifier and origin are checked server-side, and the challenge is
  server-generated, single use, and bound to the session.
- **TOTP** is acceptable. Verify the secret is server-generated from a
  cryptographic source, stored encrypted rather than plaintext, the window is
  narrow, and a used code cannot be replayed within its window. Replay protection
  is the one usually missing.
- **SMS and voice are a downgrade, not a factor.** They are recoverable by anyone
  who can move a phone number, which is an established, cheap, routine attack. If
  SMS is the only second factor, say plainly that the second factor is defeated by
  a process outside the application's control. Do not let it count as MFA.
- **Email as a second factor** is not one when the email account is also the reset
  channel. That is the same factor twice.
- **Recovery codes are credentials**: hashed, single use, invalidated on use,
  regenerated as a set, and rate limited on verification. A recovery code path
  with no rate limit is a short numeric password with unlimited guesses.
- **The challenge must bind to the completed first factor.** The classic defect:
  the first factor issues an already-authenticated session and the second factor
  is a decoration the client skips by requesting the post-login page directly.
  Read what the session holds between the two steps. It must be a pending state
  with no privileges, and the privileged session must be issued only after the
  challenge passes.

---

## Session management

For server-side sessions:

- **Generation.** A cryptographic random source with 128 bits or more of real
  entropy. Anything derived from a user identifier, timestamp, counter, or
  non-cryptographic generator is a finding regardless of length.
- **Rotation on privilege change.** A new identifier at login, at step-up, and at
  any elevation. Without it, an attacker who can set a victim's identifier before
  login holds a valid authenticated session after login. This is session fixation
  and it is still routinely present.
- **Idle timeout and absolute timeout.** Both. An idle timeout alone means a
  session used once an hour lives forever.
- **Server-side invalidation on logout.** Destruction happens in the session
  store. Clearing the cookie asks a cooperative client to forget a token that
  still works.
- **Invalidation on password change, reset, MFA change, and account disable.**
  Enumerate the other-sessions story: can a user see and end their other sessions,
  and does the application end them on a credential change?

Cookie attributes, read from the session configuration rather than inferred:

| Attribute | Requirement |
|---|---|
| `HttpOnly` | Set. Absent means a script-injection defect escalates to session theft |
| `Secure` | Set. Absent means the token crosses a cleartext channel |
| `SameSite` | `Lax` at minimum, `Strict` for sensitive applications. Absent is not the same as default, and the default varies by client |
| `Path` | Scoped as tightly as the application allows |
| `Domain` | Not a parent domain unless required. A parent domain shares the cookie with every sibling host, including the one nobody maintains |
| `__Host-` prefix | Preferred where the deployment allows. Enforces Secure, host-only scope, and root path at the client |

A framework can set these globally and a specific call site can then override
them. Read the call sites, not only the config.

---

## Self-contained tokens

The application must verify the signature and every claim it relies on. Each of
the following is a distinct, code-readable defect.

- **The `none` algorithm.** The library accepts a token declaring no signature.
  Verify the algorithm is pinned server-side and the header value does not select
  the verification path.
- **Algorithm confusion.** The verifier reads the algorithm from the token
  header, so an attacker re-signs with a symmetric algorithm using the public key
  as the shared secret. Read the verify call and confirm the expected algorithm
  is pinned there.
- **Unverified decode.** Claims are decoded and read, but the signature is never
  checked. Common, because the decode-only function and the verify function
  usually have similar names and the decode-only one is shorter. Read which one is
  called, on the actual authentication path.
- **Missing audience check.** A token issued for one service is accepted by
  another. Present wherever services share an issuer.
- **Missing issuer check.** Any party who can present a validly signed token is
  accepted, including a different trusted issuer with a different user population.
- **Missing or unenforced expiry.** The claim is present and never compared to the
  clock, or the library's check is disabled by an option.
- **Key confusion and key sourcing.** If the verification key is fetched from a
  key set named in the token itself, the attacker names their own key set. Confirm
  the key source is configured, not token-directed.
- **Signature verified, claims trusted anyway.** A verified token proves the
  issuer said this. It does not prove the claims are still true. A role claim
  minted an hour ago survives a role revocation ten minutes ago.
- **Revocation.** A stateless token cannot be revoked. If the design needs
  revocation (and it does, the moment an account can be compromised, disabled, or
  downgraded), it needs a server-side check: short expiry with a revocable refresh
  token, a deny list, or a token version counter compared per request. Confirm
  which exists. "Short expiry" is an answer only if you read the actual value and
  it is genuinely short.
- **Sensitive data in the payload.** The payload is encoded, not encrypted. Read
  what is in it.

---

## Authorization

This is where the findings are.

**Function-level versus object-level.** Function-level asks "may this identity
call this operation at all". Object-level asks "may this identity perform this
operation on THIS object". They are different checks, and passing one says
nothing about the other. Applications get function-level mostly right, because it
maps onto a middleware or a decorator. They get object-level wrong, because it has
to be written inside every handler by hand.

**Centralised enforcement versus per-handler checks.** Centralised enforcement,
where the framework refuses to dispatch a handler that has not declared its
requirement, is the architecture that survives a growing team. Scattered
per-handler checks fail in exactly one way, always the same way: the new handler
nobody added the check to. Six months later there are forty handlers with the
check and three without, and the three are not the ones anyone reviews. When you
find per-handler enforcement, the finding is rarely "this handler is wrong". It
is "the enforcement model does not fail closed", and the missing checks are the
evidence.

**The client-supplied identifier problem.** The single highest-value check in this
skill, so it gets stated in full:

> Anywhere a handler takes an identifier from the request and uses it to name the
> object it then reads, writes, or deletes, ask: what proves this identity is
> entitled to that object? The answer must be a check the server performs against
> data the client cannot influence. The identifier being hard to guess is not an
> answer. The identifier being a large random value is not an answer, it is a
> delay. The object being fetched by a repository method with `forUser` in its
> name is not an answer until you have opened that method and confirmed the user
> parameter reaches the query predicate.

The defective shape is: fetch the object by its identifier, then operate on it.
The correct shape is: fetch by identifier AND the current identity's ownership or
tenancy predicate in the same query, then operate, and treat a miss as a
not-found. Fetching first and checking afterwards is correct if the check is
genuinely there and genuinely returns, but it is fragile, and it is where the
early-return bugs live.

**Horizontal escalation** is acting on a peer's object at the same privilege
level: another user's record, another tenant's data. **Vertical escalation** is
acquiring a privilege you do not hold. Horizontal is more common and quieter;
vertical is rarer and louder. Sweep for both separately, because the searches
differ: horizontal is found by the identifier diff below, vertical by enumerating
privileged operations and reading each one's gate.

**Trusting client-supplied role, tenant, or permission claims.** Read where the
current identity's role and tenant come from on each request. If either is read
from a request parameter, header, hidden field, client-writable cookie, or a token
claim whose signature is not verified, the authorization model is a suggestion.
This is a small number of lines to read and it settles a Critical or clears it.

**Mass assignment as an authorization defect.** If a client can submit a field
mapping onto a role, tenant, owner, price, or status, the object-level check is
bypassed at write time even where the read-time check is correct. Sweep for bulk
binding of request bodies onto persistent objects, and confirm the allowlist of
bindable fields exists and excludes the security-relevant ones.

---

## Review procedure

1. **Establish the identity mechanism first.** Read, do not assume: where a
   request acquires an identity, what that identity object contains, and where its
   contents come from. Until you can name that, no other finding here can be
   scored.
2. **Read the session or token configuration in full**: cookie attributes,
   entropy source, timeouts, storage backend, algorithm pinning, claim validation.
   Then read the sites that issue sessions or tokens, because a local override
   beats a global default.
3. **Trace the login path end to end**, including every middleware ahead of it in
   registration order and the credential verification function itself. Then trace
   logout and confirm server-side destruction, not the cookie clear.
4. **Trace every reset and recovery path end to end**: generation, storage,
   transmission, consumption, invalidation, and what happens to existing sessions
   afterwards. Budget more time here than for login.
5. **Enumerate privileged operations and read each one's gate.** Administrative
   handlers, anything changing a role, anything changing billing, anything reading
   across tenants, anything that exports. Name the check and read it. This is the
   vertical escalation sweep.
6. **Run the inverted search (Phase 5 of
   `doctrine/06-investigation-playbook.md`).** The highest-value single activity
   in this doctrine. Do it as a set operation, not by eyeballing:

   a. Enumerate **set A**: every handler accepting a client-supplied object
      identifier, from any source. Path parameters, query parameters, body fields,
      headers, and identifiers embedded in a submitted document. Search by idiom
      across all of those, not just the route pattern, because an identifier in a
      body field will not appear in a route table.

   b. Enumerate **set B**: every handler in A where you have personally read a
      verified ownership or tenancy check on the path from entry to query. A
      decorator you have not opened does not put a handler in B. A repository
      helper you have not opened does not put a handler in B.

   c. Diff them. **A minus B is your candidate list.** Each member is a candidate,
      not a finding: each now goes through Rule 2 individually, including the
      refutation step.

   d. Write down the size of A, of B, and of A minus B. Those three numbers are
      coverage evidence. A reviewer who reports findings without reporting the
      denominator has not done this step.

7. **Resolve every "the middleware handles it" claim before it clears a
   candidate.** Read the registration order, confirm the mount path covers the
   handler, confirm no earlier handler short-circuits it (Rule 2). An unread
   middleware is not a control, it is an assumption with a filename.
8. **Check where role and tenant come from.** A few minutes, and it either
   produces a Critical or eliminates a whole branch of the model.
9. **Refute.** For each surviving candidate: is the route registered and reachable
   in the deployed configuration; is the framework doing the check implicitly in
   this version; is the input actually attacker-controlled. If you cannot answer
   from code you read, mark it unverified and hold it at Info.

---

## Checklist

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 13.1 | Passwords stored with a memory-hard hash (Argon2id, scrypt, or bcrypt) with a per-user salt | V6 | | |
| 13.2 | No fast general-purpose digest, and no reversible encryption, used for password storage | V6 | | |
| 13.3 | Password verification uses the library verify function, not string comparison | V6 | | |
| 13.4 | Work factor is configurable, current, and rehash-on-login exists | V6 | | |
| 13.5 | Password policy is length-led, with breached-password rejection at set and change | V6 | | |
| 13.6 | Login failure responses are identical for unknown account and wrong password | V6 | | |
| 13.7 | Registration and reset request paths do not disclose account existence | V6 | | |
| 13.8 | The account-miss path pays the same hashing cost as the account-hit path | V6 | | |
| 13.9 | Rate limiting is keyed on both source and account identifier | V6 | | |
| 13.10 | Rate limit state is server-side and not resettable by discarding the session | V6 | | |
| 13.11 | Reset tokens come from a cryptographic random source with adequate entropy | V6 | | |
| 13.12 | Reset tokens are single use, short-lived, and invalidated on use and on reissue | V6 | | |
| 13.13 | The reset token binds to one account, and no account identifier is accepted alongside it | V6 | | |
| 13.14 | Reset URLs are built from configured values, not a client-supplied host header | V6 | | |
| 13.15 | Password change or reset invalidates all other sessions for that account | V7 | | |
| 13.16 | Contact address change verifies the new address before it becomes an identity, and notifies the old one | V6 | | |
| 13.17 | MFA enrolment and MFA disable require re-authentication | V6 | | |
| 13.18 | TOTP secrets are server-generated, stored encrypted, with a narrow window and replay protection | V6 | | |
| 13.19 | SMS or voice is not the sole second factor | V6 | | |
| 13.20 | Recovery codes are hashed, single use, invalidated on use, and rate limited | V6 | | |
| 13.21 | The pre-MFA session carries no privileges, and the privileged session is issued only after the challenge passes | V6, V7 | | |
| 13.22 | Session identifiers come from a cryptographic random source with 128 bits or more of entropy | V7 | | |
| 13.23 | The session identifier is rotated at login and at every privilege change | V7 | | |
| 13.24 | Both idle and absolute session timeouts are enforced server-side | V7 | | |
| 13.25 | Logout destroys the session server-side, not only in the client cookie | V7 | | |
| 13.26 | Session cookies set HttpOnly, Secure, and SameSite, with Path and Domain scoped tightly | V7 | | |
| 13.27 | Cookie attribute defaults are not overridden at any individual issue site | V7 | | |
| 13.28 | The token verification algorithm is pinned server-side, not read from the token header | V9 | | |
| 13.29 | Tokens are verified, not merely decoded, on the authentication path | V9 | | |
| 13.30 | Issuer, audience, and expiry claims are all validated | V9 | | |
| 13.31 | The verification key source is configured, not named by the token | V9 | | |
| 13.32 | A revocation mechanism exists and is checked, or expiry is short and the value was read | V9 | | |
| 13.33 | Token payloads carry no sensitive data, given the payload is encoded and not encrypted | V9 | | |
| 13.34 | Authorization fails closed: a handler with no declared requirement is not reachable | V8 | | |
| 13.35 | Function-level authorization exists on every privileged operation, and the gate was read | V8 | | |
| 13.36 | Object-level authorization exists on every handler accepting a client-supplied identifier | V8 | | |
| 13.37 | Ownership or tenancy is enforced in the query predicate, not assumed from an unguessable identifier | V8 | | |
| 13.38 | The current identity's role is derived server-side, never read from a client-supplied value | V8 | | |
| 13.39 | The current identity's tenant is derived server-side, never read from a client-supplied value | V8 | | |
| 13.40 | Write paths do not bulk-bind request fields onto role, tenant, owner, price, or status | V8 | | |
| 13.41 | Enforcement is centralised, or the per-handler set was diffed against the handler set and the gap is zero | V8 | | |
| 13.42 | Middleware order was read and confirmed to cover every handler the review relies on it for | V8 | | |
| 13.43 | Authorization failures are logged with enough context to detect enumeration (see `doctrine/10-logging-monitoring.md`) | V8 | | |

---

## Common false positives

| Looks like a finding | Why it may not be | How to tell |
|---|---|---|
| A handler with no visible authorization check | The framework may refuse to dispatch undeclared handlers, or a mounted middleware may cover the prefix | Read the dispatch configuration and the middleware registration order. Confirm the mount path covers this route |
| A raw identifier in a route path | The ownership predicate may be inside the repository method | Open the method and follow the parameter to the query predicate. If it reaches it, this is clean |
| A helper named `requireOwner` on the handler | The name proves nothing (Rule 2) | Open it. Confirm it throws or returns rather than merely logging, and that the caller does not continue past it |
| Missing rotation at login | Some session layers rotate implicitly on privilege change | Read the session layer's behaviour for this version, not its documentation |
| A long-lived token with no revocation list | There may be a version counter or a per-request server-side check | Look for a per-request identity load. If the identity is re-read from the datastore every request, revocation exists in effect |
| No lockout on login | Lockout is not the only control, and unbounded lockout is itself a denial-of-service vector | Check for progressive delay or equivalent. Absence of lockout specifically is not a finding if a working limiter exists |
| An unguessable identifier with no ownership check | Unguessability delays enumeration, it does not authorize | Still a finding. Reachability drops to Constrained only if the identifier is genuinely never disclosed anywhere, which you must prove, including in logs, referrers, and support tooling |
| Client-side route guards absent | Client-side guards are user experience, not a control | Neither presence nor absence is a finding. Score the server |
| A role claim in a token | It may be verified and freshly minted | Confirm the signature is verified and the claim is not authoritative past a revocation. If it is authoritative and long-lived, that is the finding, not the claim's existence |

---

## Notes on severity

Score against `rubrics/scoring.md`; do not re-derive it here. The mappings that
recur in this area:

- **Authentication bypass for any account** is Catastrophic impact by definition.
  Reachability is usually Open, which puts it at Critical.
- **Reading or modifying another user's data via a missing object-level check** is
  Severe impact at Authenticated reachability. That is High. It is the most common
  serious finding in this doctrine, and it is worked example A in the rubric.
- **The same defect behind a role you read and confirmed is narrowly held** drops
  Reachability to Constrained, so Medium. Note that "narrowly held" is a claim
  about the target's operations that you probably cannot verify from code. If you
  cannot, say so, and do not quietly take the discount.
- **Vertical escalation to an administrative operation** is Severe or Catastrophic
  depending on what that operation can do. Read the operation before choosing.
- **Session fixation, missing rotation, missing timeout, missing cookie
  attribute** are each usually Moderate impact alone, and they compound. A missing
  `HttpOnly` is a hardening item until there is an injection defect, at which point
  it is the difference between a defaced page and a stolen session. Score them
  independently and say what they chain with.
- **Account enumeration** is Minor to Moderate. Do not inflate it. Do note whether
  the rate limiting result makes it a live credential stuffing enabler, and
  cross-reference the two findings.
- **A pattern you found by grep and did not trace** is Info and unverified,
  however bad it looks. The verification ceiling applies hardest here, because
  authorization findings are the ones a reader acts on immediately, and the ones
  that damage the report most when wrong.
