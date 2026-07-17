# 17. Rate Limiting and Abuse Resistance

**Doctrine ID:** `17-rate-limit-abuse`
**Mode:** review and build
**Source standards:** ASVS 5.0 validation and business logic chapter, OWASP API
Security Top 10 2023 API4 (Unrestricted Resource Consumption) and API6
(Unrestricted Access to Sensitive Business Flows), OWASP Denial of Service
Cheat Sheet, OWASP Automated Threats to Web Applications (OAT)

---

## Purpose

This doctrine covers two related things that are usually conflated: mechanical
rate limiting, and resistance to abuse of a flow that is being used exactly as
designed. It fires on every review of anything with an HTTP surface. There is
no application that needs no limits, and the endpoints that need them most are
the ones that were written first, before anyone was thinking about limits.

## Principles

1. **Rate limiting and abuse resistance are different problems.** A rate limit
   is mechanical: N requests per unit time per key. Abuse resistance is about
   outcomes: how many accounts, how many password guesses, how many units of
   inventory, how many messages sent. A flow can be abused thoroughly at a
   perfectly reasonable request rate. If the only control is a request counter,
   the patient attacker wins and never trips it.
2. **A limit you cannot point at in the code does not exist.** Config comments,
   README claims, and a middleware named `throttle` are not evidence. Read the
   registration, read the implementation, read the store. Rule 3.
3. **Every choice of limit key is flawed. Pick deliberately and say which flaw
   you accepted.** There is no correct key, only a documented trade-off.
4. **The limits that matter are on the endpoints nobody thinks of as
   expensive.** Password reset sends mail. Search runs a query. A webhook
   retries. Each one costs somebody money or attention.
5. **Verification is a set difference, not a vibe.** Enumerate what needs a
   limit. Enumerate what has one you read. Diff. The answer is a number, and
   the number is usually worse than the team expects.

---

## A limit in process memory is not a limit

Read this section before you accept any limiter as present. This is the most
common finding in this doctrine and reviewers under-rate it consistently,
because the code looks right. It is right. It is just in the wrong place.

A counter held in server memory, in a session, in a module-level map, or in a
process-local cache fails in four separate ways, any one of which is total:

- **It resets when the process restarts.** Deploys, crashes, autoscaling, and
  idle recycling all clear it. On a platform that recycles aggressively the
  limiter may never survive long enough to fire.
- **It is per-instance.** Run N instances behind a load balancer and the
  effective limit is N times the configured limit, because each instance counts
  only what it saw. Nobody notices, because the config still says 5.
- **It is bypassed by anything that starts fresh.** A session-scoped counter is
  defeated by discarding the session cookie: one line of attacker code. A
  session-scoped login limiter is not a login limiter, it is a speed bump for
  people who are not attacking you.
- **It is bypassed by hitting a different node.** No cleverness required. Retry,
  and the load balancer eventually routes you somewhere with a clean count.

A limit must live in a store shared by every instance that serves the endpoint,
and it must be keyed on something the client cannot reset for free. The store
being shared is not enough on its own: a shared store keyed on the session
identifier is still bypassed by a new session.

**Confirm this by reading the code, not the config comment (Rule 3.)** The
specific thing to read is where the counter is written and where it is read
back. If both are in the same process's memory, you have found it. If the store
is external, confirm the key: an external store keyed on something resettable
buys you nothing except a network hop.

The honest severity note: this finding usually presents as "rate limiting is
implemented" in the team's own understanding, which is why it survives to
production. Say plainly in the finding that the code is not absent, it is
ineffective, and name which of the four failures applies.

---

## Algorithms, briefly

You need enough of this to judge whether a limiter does what its author thinks.
No more.

- **Fixed window.** Count per calendar window, reset at the boundary. Cheap and
  the most common. Its flaw is the **boundary burst**: the limit is enforced per
  window, not per duration, so an attacker sending the full budget just before
  the boundary and again just after gets twice the limit in an instant. A
  "100 per minute" fixed window permits 200 in two adjacent seconds. If the
  threshold was chosen to protect a downstream resource, that burst is the thing
  it was chosen to prevent.
- **Sliding window.** Counts over a trailing duration, either by keeping
  timestamps or by weighting the previous window. Removes the boundary burst,
  costs more memory or arithmetic. This is the right default for most
  endpoints.
- **Token bucket.** Tokens refill at a fixed rate up to a cap; each request
  spends one. Allows a deliberate burst up to the cap and then settles to the
  refill rate. Good where clients are legitimately bursty and you want to permit
  it without permitting a sustained flood.
- **Leaky bucket.** Requests queue and drain at a fixed rate; overflow is
  rejected. Smooths output rather than input, which is what you want when
  protecting something downstream that has its own hard rate ceiling.

What the reviewer does with this: identify which one is implemented, and check
that the threshold matches the intent. A fixed window where someone reasoned
about a sustained rate is a real finding, and the fix is usually a one-line
change of algorithm rather than a change of threshold. Do not file the choice
of algorithm as a finding on its own; file it when the burst it permits defeats
the purpose the limit was there to serve.

---

## Review procedure

### Step 1: Enumerate the endpoints that need a limit

Not every endpoint. These, specifically, and you should expect to find them by
following the idioms rather than by grepping for "limit":

- **Authentication.** Login, and every alternative credential path: token
  exchange, API key auth, remember-me, SSO callback.
- **Password reset.** Both the request side (sends mail, enumerates accounts)
  and the redeem side (guesses the token).
- **MFA verification.** A six-digit code with no attempt limit is a six-digit
  code with no security. This is the highest-value missing limiter in most
  applications and it is missed constantly, because the login above it has one.
- **Registration.** Mass account creation is the precursor to most other abuse.
- **Anything that sends a message.** Mail, SMS, push, webhook. Each send costs
  money and burns sender reputation. An unlimited send endpoint is also a way
  to use your infrastructure to harass a third party.
- **Anything that costs money.** Metered third-party calls, model inference,
  transcoding, geocoding, payment processor calls.
- **Anything that triggers work on a third party.** Your limit protects their
  limit. If they throttle you, your outage is self-inflicted.
- **Search, and any expensive query.** Full text, joins over large tables,
  aggregates, report generation, export.
- **Any enumeration surface.** Anything that answers "does this exist" for an
  identifier the client supplies: usernames, emails, coupon codes, order IDs,
  invitation tokens.
- **Upload.** Cross-reference `doctrine/14-file-upload.md`.

Record the set. This is the denominator.

### Step 2: Enumerate the limits that actually exist

For each, read the implementation, apply the memory-store test above, and
record:

- Where the counter lives.
- What it is keyed on.
- The window and the threshold.
- What happens when the store is unreachable.
- Whether it is registered on the route you think it is. A limiter defined and
  never bound is common. So is a limiter bound to the router but ordered after
  the handler.

### Step 3: Diff the two sets

The gap is the finding list. This is Phase 5 of
`doctrine/06-investigation-playbook.md`, and it is the single most productive
mechanical technique in this doctrine. It produces a defensible, countable
result rather than an impression.

### Step 4: Assess the keying

Ask what the key is and name its flaw honestly. There is no clean answer:

- **IP address.** Shared by whole networks: carrier-grade NAT, a corporate
  egress, a university, a household. Trivially rotated by anyone with a proxy
  pool, which costs approximately nothing. The honest trade-off is stark: **an
  IP-keyed limit blocks legitimate users behind a shared address, and fails to
  stop a distributed attacker.** It penalises exactly the people it need not
  stop and does not stop the people it should. Still worth having, because it
  raises the floor against the unsophisticated attacker, who is most of them.
  Do not report it as adequate on its own.
- **User ID.** Works only after authentication, which is precisely where the
  login brute force is not: the attacker has no user ID because authenticating
  is the thing they are trying to do. A user-keyed limit is useless on the
  endpoint that most needs one.
- **Account identifier supplied in the request.** Better for login: it limits
  guesses per target account regardless of source. Its own problem is that an
  attacker can lock out a known account by exhausting its budget on purpose.
  Prefer slowing over locking.
- **API key or client identifier.** Good where one exists. Not present on the
  paths that need help.
- **Device or client fingerprint.** Weak, defeatable, and it carries privacy
  cost. Cross-reference `doctrine/18-privacy-and-data-protection.md` before
  recommending one.

The practical answer is layers: several keys with different thresholds, so that
defeating one does not defeat all. Report a single-keyed limiter as what it is:
a control with a known bypass.

### Step 5: Read the failure mode

When the limit store is unreachable, does the request proceed or fail?

Name the trade-off, do not prescribe a universal answer. Fail-closed converts a
store outage into an application outage, which is a real cost and is why
fail-open is the usual default in every library that offers the choice.

But state this plainly: **fail-open on the login limiter converts a store
outage into an open brute-force window,** and an attacker who can cause or wait
for that outage gets unlimited guesses at every account. That is usually the
wrong trade, and it is usually the default. The asymmetry is that the outage is
temporary and the credential compromise is permanent.

The reviewer's job is to establish which behaviour is in the code and whether
anyone chose it. An unexamined library default is not a decision.

### Step 6: Read the response behaviour

- Is the status `429` with a `Retry-After`? A well-behaved client backs off
  when told to. A limiter that returns a generic 500 trains clients to retry
  harder.
- **Does the response leak whether the limit was hit because the account
  exists?** A limiter that rate-limits real accounts and instantly rejects
  unknown ones is an account enumeration oracle built out of a security
  control. Cross-reference the enumeration section of
  `doctrine/13-auth-and-session.md`. The limiter must behave identically for
  accounts that exist and accounts that do not, including timing where the
  timing is measurable.
- Does the limiter respond before doing the expensive work? A limiter that runs
  the query and then declines to return it has not saved anything.
- Prefer progressive delay over hard lockout where the endpoint is
  authentication. Lockout is a denial-of-service primitive pointed at your own
  users.

### Step 7: Look for consumption that is not request count

Request count is one axis. These are the others, and API4 covers all of them:

- **Response size.** An endpoint that returns everything when `limit` is
  omitted. Check the default, not the documented maximum.
- **Pagination.** Is there a maximum page size, and is it enforced server-side
  against the client's parameter? A client-supplied `per_page` with no cap is
  an unbounded query.
- **Query complexity and depth.** For graph-style APIs, cost is a function of
  the query, not of the request count. One request can be arbitrarily
  expensive. The controls are depth limiting, complexity scoring against a
  budget, and disabling introspection where it is not needed. A request-per-
  minute limit on a graph endpoint is close to meaningless on its own.
- **Upload size.** Cross-reference `doctrine/14-file-upload.md`, including the
  point that the limit must fire before buffering.
- **Regular-expression backtracking.** A pattern with nested quantifiers over
  client-supplied input is a CPU exhaustion primitive in one line. Look at every
  pattern that touches request data, especially validation patterns, which are
  by definition applied to hostile input before anything else runs.
- **Unbounded allocation from a client-supplied count.** Any parameter that
  becomes a loop bound, an array size, an iteration count, or a batch size. Read
  for a cap.
- **Decompression.** Compressed request bodies expand. So do archives; see
  `doctrine/14-file-upload.md`.

### Step 8: Look for business-flow abuse

API6. This is the class where every individual request is legitimate,
authenticated, authorized, and within every rate limit, and the aggregate is
the attack. No mechanical limiter catches these, because there is nothing
mechanically wrong.

- **Scalping.** Automated purchase of limited inventory faster than a human
  can.
- **Scraping.** Assembling your entire dataset one authorized record at a time.
- **Mass account creation.** Each registration is valid. Ten thousand of them
  is not.
- **Gift card, voucher, and coupon enumeration.** Each redemption attempt is a
  legitimate use of the redemption endpoint.
- **Credential stuffing.** Each login attempt is one attempt against one
  account, from one address, and the whole campaign is millions of them across
  a botnet.

The question to ask of each business flow is not "how fast can this be called"
but "what does an attacker get by calling this a lot, and would we notice". The
controls are outcome-based: inventory holds per identity, cost asymmetry,
proof-of-work or challenge on the flow, device and behavioural signals, and
detection. **Detection lives in `doctrine/10-logging-monitoring.md`.** If a
business flow has no limit and no detection, the finding is that the abuse
would complete and nobody would know, and that second half is the worse one.

---

## Checklist

Evidence column stays blank until you have read the code. Rule 3.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 17.1 | Every endpoint needing a limit is enumerated, and the enumeration is recorded | 11.1 | | |
| 17.2 | Limits are stored in a shared store, not in process memory or a session | 11.1 | | |
| 17.3 | The limit key cannot be reset for free by the client | 11.1 | | |
| 17.4 | The limiter is registered on the route, and ordered before the handler | 11.1 | | |
| 17.5 | Login is rate limited, keyed so that an unauthenticated attacker is constrained | 2.2 | | |
| 17.6 | Password reset request is rate limited, per account and per source | 2.5 | | |
| 17.7 | Password reset redemption is rate limited against token guessing | 2.5 | | |
| 17.8 | MFA verification has an attempt limit and the code is invalidated on exhaustion | 2.8 | | |
| 17.9 | Registration is rate limited and has an anti-automation control | 11.1 | | |
| 17.10 | Every message-sending path is rate limited per actor and per recipient | 11.1 | | |
| 17.11 | Every metered or paid third-party call is rate limited on our side | 11.1 | | |
| 17.12 | Search and expensive queries are rate limited and bounded | 11.1 | | |
| 17.13 | Enumeration surfaces are rate limited and respond uniformly | 11.1 | | |
| 17.14 | Limiter behaviour is identical for accounts that exist and accounts that do not | 2.2 | | |
| 17.15 | The limiter rejects before performing the expensive work | 11.1 | | |
| 17.16 | Rate limited responses return 429 with `Retry-After` | 11.1 | | |
| 17.17 | Authentication uses progressive delay rather than a lockout that a third party can trigger | 2.2 | | |
| 17.18 | Behaviour when the limit store is unreachable is deliberate and documented | 11.1 | | |
| 17.19 | The login limiter does not fail open | 2.2 | | |
| 17.20 | Pagination has a server-enforced maximum page size | 11.1 | | |
| 17.21 | Default response size is bounded when the client supplies no limit | 11.1 | | |
| 17.22 | Graph-style APIs enforce depth limits and complexity budgets | 11.1 | | |
| 17.23 | Introspection is disabled where it is not required | 14.3 | | |
| 17.24 | Client-supplied counts, batch sizes, and loop bounds are capped | 11.1 | | |
| 17.25 | Regular expressions applied to request data are free of nested quantifiers, or are bounded | 11.1 | | |
| 17.26 | Compressed request bodies have a bounded expanded size | 11.1 | | |
| 17.27 | Request body size is bounded before buffering | 11.1 | | |
| 17.28 | Sensitive business flows are identified and have outcome-based limits | 11.2 | | |
| 17.29 | Sensitive business flows have detection, not only prevention | 7.2 | | |
| 17.30 | Limit breaches are logged with enough context to identify a campaign | 7.2 | | |
| 17.31 | Limits are tested, and the test would fail if the limiter were removed | 11.1 | | |
| 17.32 | The limiter's algorithm suits the intent, and a fixed-window boundary burst does not defeat the threshold | 11.1 | | |

---

## Common false positives

| Looks like a finding | Why it may not be | How to tell |
|---|---|---|
| No limiter in the application code | The reverse proxy, gateway, or CDN may enforce one | Read that config. If it is not in the repo, you cannot verify it: unverified, Info, and name what would settle it. Do not assume it exists, and do not assume it does not |
| An in-memory limiter | It is a real finding, and it is listed here because it is routinely dismissed | If the deployment is genuinely a single process that never restarts, the reachability argument weakens. Confirm that claim; it is almost never true, and it stops being true the first time it scales |
| Login has no limiter | An upstream gateway or an identity provider may own authentication entirely | Trace where credentials are actually verified. If authentication is delegated, the limit belongs to the delegate, and whether it exists is unverified from this repo |
| No 429, returns 403 | The status code is a correctness item, not a security failure by itself | Judge whether the limit fires at all. Report the status separately, at Low |
| Fail-open limiter | On a non-authentication endpoint this can be a reasonable deliberate trade | Ask whether it was chosen. On login it is not reasonable. On a search endpoint it may be exactly right |
| Unbounded pagination | A hard cap may be applied in the data layer or the ORM's own default | Read the query construction. Cross-reference `doctrine/15-database-access.md` |
| High limits | A high limit is a decision. A missing limit is a defect | Do not file "the limit is 1000 and I would have picked 100" as a finding. Unless you can show the threshold fails to stop the attack, it is an opinion |
| Business flow with no rate limit | The flow may be constrained by something else entirely: inventory holds, payment friction, manual approval | Read for the constraint. If the aggregate abuse is genuinely bounded by something you read, there is no finding |

---

## Notes on severity

Score against `rubrics/scoring.md`. These are the mappings this area gets
wrong.

- **No limit on login, or an in-memory limit on login.** The impact is
  authentication bypass for any account given enough attempts, which is
  Catastrophic. Reachability is Open. **Critical.** Reviewers routinely file
  this at Medium because "it's just a missing rate limit". It is not. It is the
  control standing between an unauthenticated attacker and every account. The
  in-memory case scores identically to the absent case once you have confirmed
  the bypass, because a control with a one-line bypass is not a control.
- **No attempt limit on MFA verification.** Same argument. A short numeric code
  with unlimited attempts is not a factor. Catastrophic impact, and
  reachability is Constrained only if the attacker must first hold valid
  primary credentials, which in a credential-stuffing world is a weak
  constraint. Usually **Critical**, at minimum **High**.
- **No limit on password reset request.** Two findings, not one: mail cost and
  reputation damage (Moderate), and account enumeration if the response differs
  (Moderate, and it feeds the login attack). Score them separately.
- **Fail-open on the login limiter.** The finding is not the fail-open, it is
  that the limiter has an availability-triggered off switch. Reachability is
  Constrained if the attacker must wait for or cause an outage. Impact is
  whatever the missing login limiter's impact is. Say explicitly that this is
  usually the wrong trade and that it is usually the default nobody chose.
- **Unbounded pagination or response size.** Moderate impact, reachability per
  the endpoint's auth. This is a real **High** on an open endpoint and it does
  not need inflating. If it returns other users' data, that is a different and
  worse finding, and it belongs to `doctrine/13-auth-and-session.md`.
- **Regular-expression backtracking.** Moderate impact (denial of service),
  reachability Open if the pattern is on an unauthenticated validation path.
  Rule 2 applies hard: confirm the pattern actually backtracks catastrophically
  against reachable input, do not file every nested quantifier you grep. A
  pattern anchored and bounded is not a finding.
- **Business-flow abuse with no detection.** The impact is the business impact,
  which you often cannot size from code alone. Where you cannot, that is
  `verified: false` and the ceiling holds it at Info. Say what would settle it,
  and be honest that this class frequently cannot be settled by code read: it
  needs the flow's economics, which is the user's knowledge, not yours.
- **Missing limits on an endpoint that costs money.** Do not score this on the
  dollar figure. Score the impact class: denial of service against the tenant,
  or resource exhaustion. The financial detail belongs in the finding's body
  where it will actually get read.
