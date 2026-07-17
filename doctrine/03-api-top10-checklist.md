# 03. API Security Top 10 (2023) Checklist

**Doctrine ID:** `03-api-top10-checklist`
**Mode:** review
**Source standards:** OWASP API Security Top 10 (2023), categories API1 to API10

---

## Purpose

This doctrine runs the ten 2023 API Security Top 10 categories over any API
surface in `<target-repo>`. It exists because the web Top 10 was written with a
server-rendered application in mind and its assumptions do not survive contact
with an API: there is no page to hang a role check on, no template to escape
into, and the client is not a browser you control. Run it after
`doctrine/04-web-top10-checklist.md`, and only if there is an API surface.

## Principles

1. **API1 and API5 are the review.** Object-level and function-level
   authorization account for most of what actually goes wrong in an API. If you
   only have time for two categories, do these two properly rather than all ten
   badly.
2. **The client is not a control.** Every constraint the frontend applies is
   advisory. The endpoint is the boundary, and it is the only thing you review.
   A field hidden in the UI is a field that ships in the response.
3. **Authorization is per-object and per-request.** There is no such thing as
   an authorized endpoint, only an authorized request for a specific object by
   a specific caller. A route-level check is a different control and it does not
   substitute.
4. **Both directions.** Data crosses the boundary inbound and outbound, and the
   defects are symmetric. Reviewers reliably check one direction and call the
   category done.
5. **Documentation is not inventory.** A specification file describes an
   intention. Under Rule 3 the route table in code is truth, and the deployed
   surface is a third thing that neither of them proves.

## Review procedure

1. Enumerate the API surface from the inventory: every route, its method, its
   authentication requirement, and whether it takes an identifier.
2. Run API1 and API5 first, using the inverted search below. These are slow and
   they are the point.
3. Run API3 in both directions on the same handler set.
4. Run the remaining categories.
5. Apply Rule 2 to every candidate before it gets a severity above Info.
6. Record what you could not settle from the tree in `unverified.md`. For an
   API review this list is normally long, and API9 is usually on it.

---

### API1: Broken Object Level Authorization

The caller is authenticated, supplies an identifier for an object, and the
handler returns it without ever asking whether that object is theirs. This is
the single most common serious API defect, and it is a per-object property:
the same handler can be correct for one caller and wrong for the next, which
is why nothing at the route level can settle it. It survives review because the
handler looks completely ordinary. There is no dangerous function call, no bad
import, no suspicious string. The defect is an absence.

**Search strategy (inverted set difference).** Do not look for the bug. Look for
the check, and then find who lacks it.

1. Enumerate set A: every handler that takes a client-supplied identifier.
   Search by idiom, path parameters in route declarations, identifier fields
   read out of the body or query, and identifiers pulled from headers. Include
   nested and batch identifiers: a list of ids in one body is still set A.
2. Enumerate set B: every handler where ownership or tenancy is actually
   verified. Two idioms qualify. Either the lookup is scoped by an identity
   taken from server-side session or token state (the query filters on both the
   object id and the caller), or an explicit authorization call is made against
   the loaded object and its failure branch denies.
3. Diff. `A minus B` is your candidate list. It is a list, not a finding.
4. Read every candidate under Rule 2. Open the middleware, the decorators, the
   base class, the repository wrapper. Ownership is often enforced one layer
   down, and a scoped repository makes set B larger than the grep suggested.
   Equally, an authorization helper called in the `GET` branch and not the
   `DELETE` branch keeps the handler in set A.

Phase 5 of `doctrine/06-investigation-playbook.md` is the authorization trace.
Use it for every candidate that survives step 4. Deeper doctrine on how identity
is established in the first place: `doctrine/13-auth-and-session.md`.

Coverage here is reportable and you should report it: candidates found, traced,
and confirmed. `A minus B` where you traced a third of it is not a clean pass.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.1.1 | Set A (handlers taking a client-supplied identifier) is fully enumerated | V4.2 | | |
| 03.1.2 | Every member of set A has an ownership or tenancy check traced to its failure branch | V4.2 | | |
| 03.1.3 | The check compares against identity from server-side state, not a request field | V4.1 | | |
| 03.1.4 | Every HTTP method on a given resource is checked, not only the read path | V4.2 | | |
| 03.1.5 | Nested, batch, and bulk identifiers are authorized per item | V4.2 | | |
| 03.1.6 | Unpredictable identifiers are not treated as the authorization control | V4.2 | | |
| 03.1.7 | Not-found and forbidden responses do not let an attacker enumerate object existence | V4.2 | | |
| 03.1.8 | Scoped repository or query helpers, where relied on, have been opened and read | V4.2 | | |

---

### API2: Broken Authentication

The mechanism that turns a request into an identity is wrong, or is right and
can be skipped. In an API the surface is wider than a login form: token issuance
and verification, key handling, refresh, service-to-service credentials, and
whatever legacy path was left routed. The frequent shape is a verification
routine that accepts more than it should, an unenforced algorithm, an ignored
audience, an expiry checked in one code path and not another.

**Search strategy (by idiom):** find the token verification call and read every
parameter it is given and every default it relies on. Read the failure branches:
a verification that catches an exception and continues is the classic. Find
every route registration and compare it against the middleware that should be
applying authentication, looking for the route that was registered outside the
group. Deeper doctrine: `doctrine/13-auth-and-session.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.2.1 | Every route is accounted for as authenticated or deliberately public | V2.1 | | |
| 03.2.2 | Token verification enforces algorithm, signature, expiry, issuer, and audience | V3.5 | | |
| 03.2.3 | Verification failure branches deny; none catch and continue | V3.5 | | |
| 03.2.4 | Tokens and API keys are not accepted from a query string | V3.5 | | |
| 03.2.5 | Credential and token endpoints are rate limited by a durable mechanism | V2.2 | | |
| 03.2.6 | Refresh and revocation invalidate server-side state | V3.3 | | |
| 03.2.7 | Service-to-service credentials are distinct per caller and revocable | V2.10 | | |

---

### API3: Broken Object Property Level Authorization

The caller is allowed the object and not allowed every field of it. The 2023
edition merged mass assignment and excessive data exposure into one category
precisely because they are one defect seen from two sides, and merging them was
a hint that reviewers were checking one and stopping.

**Inbound (mass assignment):** the request body is bound to a model and the
caller sets a field they should not control. `role`, `tenant_id`, `verified`,
`balance`, `is_admin`, the price on an order. The binding is convenient and
that is exactly the problem.

**Outbound (over-exposure):** the handler serializes the whole object and the
response carries fields the caller should never see. Internal identifiers,
another user's contact details on an embedded relation, the password hash, the
soft-delete reason. The UI does not render them, so nobody noticed. This is
found by reading the response body, not the frontend.

Check both directions on the same handler. Reviewers check one.

**Search strategy (by idiom):** for inbound, find every whole-body bind, the
idiom where a request object is passed to a model constructor, an update call,
or a merge. An explicit field-by-field mapping is safe by construction; a bind
of the whole body is the shape you want. For outbound, find the serialization
boundary and determine whether it is a deny-list (fields excluded by name) or an
allow-list (fields included by name). Deny-lists fail every time a field is
added to the model, so a deny-list is a finding waiting for a migration.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.3.1 | Inbound binding is field-by-field or allowlisted; no whole-body bind to a persisted model | V5.1 | | |
| 03.3.2 | Privilege, ownership, tenancy, and financial fields are unsettable from a request body | V5.1 | | |
| 03.3.3 | Outbound serialization is an allow-list of fields, not an exclusion list | V8.1 | | |
| 03.3.4 | Embedded and related objects are filtered per caller, not serialized whole | V8.1 | | |
| 03.3.5 | Field-level permissions differ per role where the data model requires it, and are enforced server side | V4.1 | | |
| 03.3.6 | Response shape was read from the serializer, not inferred from the client code | V8.1 | | |

---

### API4: Unrestricted Resource Consumption

A request is allowed to cost more than it should. Not only bandwidth and CPU:
an API call that triggers a message send, a third-party call that is billed per
request, or a query that fans out across a graph all convert traffic into money
or into unavailability. APIs make this worse than web apps because there is no
human pacing the requests and no page render between them.

**Search strategy (by idiom):** find the pagination defaults and read what
happens when the limit parameter is absent, zero, or very large. Find any
endpoint that accepts a depth, an expansion, a field selection, or a nested
query, because those are multipliers. Find every request-triggered outbound call
that costs money. Read the upload path for a size bound and the parser for a
recursion bound. Deeper doctrine: `doctrine/17-rate-limit-abuse.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.4.1 | Every collection endpoint has a maximum page size enforced server side | V13.1 | | |
| 03.4.2 | Client-supplied limit, depth, and expansion parameters are bounded, not merely defaulted | V13.1 | | |
| 03.4.3 | Request body and upload sizes are capped before parsing | V13.1 | | |
| 03.4.4 | Query complexity or fan-out is bounded where the API allows nesting | V13.1 | | |
| 03.4.5 | Operations that cost money per call are rate limited per caller | V13.1 | | |
| 03.4.6 | Timeouts exist on outbound calls so one slow dependency cannot exhaust the pool | V13.1 | | |
| 03.4.7 | Rate limiting is durable and keyed to identity, not held in per-process memory | V13.1 | | |

---

### API5: Broken Function Level Authorization

The caller can invoke an operation their role does not permit. Distinct from
API1: API1 is the wrong object, API5 is the wrong verb. The administrative
endpoint that checks nothing because the admin UI is the only thing that calls
it. The `DELETE` on a resource whose `GET` is properly guarded. The route added
last month outside the group where the role middleware is registered.

**Search strategy (inverted, same method as API1).** Enumerate every route with
its method. Enumerate every route that has a role or permission check on it,
tracing the middleware registration rather than trusting a decorator's name.
Diff the two. Then sort the difference by what the operation does: an unguarded
read of public reference data is not a finding, an unguarded state change is.
Pay attention to method-level gaps on the same path, since that is the shape a
route-listing review misses.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.5.1 | Every route and method pair is enumerated with its required role | V4.1 | | |
| 03.5.2 | Role checks are traced to the middleware registration, not assumed from a decorator name | V4.1 | | |
| 03.5.3 | Administrative functions are authorized independently of path obscurity or client separation | V4.3 | | |
| 03.5.4 | State-changing methods on a guarded path are guarded to the same standard as the read | V4.1 | | |
| 03.5.5 | Default is deny for routes that match no policy | V4.1 | | |
| 03.5.6 | Role is derived from server-side state and cannot be asserted by the client | V4.1 | | |

---

### API6: Unrestricted Access to Sensitive Business Flows

A flow is abused at scale, and every individual request in the abuse is
perfectly legitimate and correctly authorized. This is the category that defeats
per-request review completely, because there is no wrong request to find. Buying
the entire stock of a limited item within a second of release. Creating ten
thousand accounts to farm a signup credit. Enumerating a directory one valid
lookup at a time. Reserving inventory and never paying, at volume.

Nothing in the code is broken. The flow works exactly as designed, which is what
makes it an Insecure Design problem with an API-shaped consequence, and why no
grep will surface it. You find it by asking, per flow, what an adversary with a
script and unlimited legitimate accounts could extract from it, then checking
whether anything bounds that. The threat model from step 2 of the skill
procedure is the input.

Deeper doctrine: `doctrine/17-rate-limit-abuse.md`. The controls that address
this are not authorization controls; they are cost, pacing, and identity
controls, and they belong to that file.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.6.1 | Business flows worth abusing are identified from the threat model, not from the code | V1.1 | | |
| 03.6.2 | Each identified flow has a stated limit per identity, per address, or per time window | V13.1 | | |
| 03.6.3 | Limits are enforced server side in durable state, not per process | V13.1 | | |
| 03.6.4 | Account creation cost is proportionate to what an account unlocks | V1.1 | | |
| 03.6.5 | Automation is detectable on the flows where it matters, or the absence is a stated accepted risk | V13.1 | | |
| 03.6.6 | Bulk and enumeration patterns across many valid requests are observable in logs | V7.2 | | |

---

### API7: Server Side Request Forgery

The API fetches a URL the caller influenced, from inside your network, with
whatever ambient credentials the fetching component holds. APIs concentrate this
because taking a URL is a normal API feature: webhook registration, importing a
resource by link, rendering a document, generating a preview. The attacker gets
a request origin they could not otherwise obtain.

**Search strategy (by idiom):** find every outbound HTTP client construction and
trace the URL argument backwards to see whether any request field reaches it.
The dangerous shape is any client-supplied host, path, or whole URL. Read the
validation carefully. Pre-fetch validation that does not survive a redirect, and
name resolution that happens twice (once for the check and once for the fetch),
are the two standard broken controls, and both look correct at a glance.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.7.1 | Every outbound fetch with a client-influenced URL is enumerated | V12.6 | | |
| 03.7.2 | Destination hosts are allowlisted rather than deny-listed | V12.6 | | |
| 03.7.3 | Redirects are not followed, or the new destination is re-validated | V12.6 | | |
| 03.7.4 | Loopback, link-local, and private ranges are blocked after resolution, not before | V12.6 | | |
| 03.7.5 | Fetch responses, status codes, and timings are not reflected to the caller | V12.6 | | |
| 03.7.6 | The fetching component carries no ambient credential the destination could capture | V12.6 | | |

---

### API8: Security Misconfiguration

The API is capable of being secure and is not deployed that way. In an API the
specifics differ from a web app: CORS is a real control rather than a nuisance,
verbose errors leak schema rather than stack traces, unnecessary methods are
routable, and the transport is often terminated somewhere you cannot see from
the tree. Deeper doctrine on the configuration and secret surface:
`doctrine/08-secrets-and-config.md`.

**Search strategy (by idiom):** read the CORS configuration and determine
whether the allowed origin is a fixed set or reflected from the request. Read
the error boundary for what it serialises to the caller. Find the framework
defaults that apply when a setting is absent, since absent is what ships.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.8.1 | CORS allowed origins are a fixed set; the request origin is never reflected | V14.5 | | |
| 03.8.2 | Credentialed CORS is not paired with a wildcard or a reflected origin | V14.5 | | |
| 03.8.3 | Error responses expose no schema, query text, framework version, or internal path | V7.4 | | |
| 03.8.4 | Only the intended HTTP methods are routable on each path | V14.2 | | |
| 03.8.5 | TLS is enforced on every hop including internal service calls | V9.1 | | |
| 03.8.6 | Debug, introspection, and schema-explorer endpoints are not reachable in production | V14.1 | | |
| 03.8.7 | Configuration defaults to the secure value when a setting is absent | V14.1 | | |

---

### API9: Improper Inventory Management

The versions, environments, and hosts you forgot. The old API version still
routed because one mobile client never updated. The staging deployment reachable
from the internet, pointed at a copy of production data. The internal service
exposed by an ingress rule nobody reviewed. The endpoint that was never in the
specification and is still live. Every one of these is a surface where your
current controls do not apply, because they were written before the controls
existed and nobody re-reviewed them.

**Search strategy (by idiom, partial):** find version prefixes in route
registrations and compare the set to what the documentation claims. Find routes
registered outside the main table, in feature flags, in conditional blocks, in
generated code. Compare the specification file against the route table, in both
directions: undocumented routes and documented-but-absent routes are both signal.

**This often cannot be settled by code read alone, and that is the expected
outcome.** The tree tells you what routes exist in this branch. It does not tell
you what is deployed, on which hosts, at which versions, reachable from where.
Under Rule 2 a claim about the deployed surface that you cannot verify from code
is unverified and holds at Info. That is the correct result, not a failure of
the review. Record it in `unverified.md` with the specific question a human with
infrastructure access should answer, because a precise unanswered question is
worth more than a confident guess.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.9.1 | All API versions present in the route table are enumerated | V14.2 | | |
| 03.9.2 | Deprecated versions are either removed or confirmed to carry current controls | V14.2 | | |
| 03.9.3 | The specification and the route table agree in both directions | V14.2 | | |
| 03.9.4 | Routes registered conditionally or outside the main table are identified | V14.2 | | |
| 03.9.5 | Non-production environments and their exposure are named, or recorded as unverified | V14.2 | | |
| 03.9.6 | Hosts, ingress, and exposure are recorded as unverified where the tree cannot settle them | V14.2 | | |

---

### API10: Unsafe Consumption of APIs

You trusted a third party's response. Integrations get reviewed as though the
remote end is part of your trust boundary, because a contract was signed and the
connection uses TLS. Neither of those makes the response data safe. A compromised
or simply buggy provider returns a payload that lands in your database, your
template, or your query, and the code that handles it has none of the validation
you would apply to a user.

**Search strategy (by idiom):** find every inbound integration point, the
response handling of outbound calls, the webhook receivers, the callback
endpoints, and follow the parsed data forward to a sink. It is the injection
search with a different source set, and the source set is the one nobody
enumerated. Read whether the response is validated against a schema or bound
straight to a model. Read the webhook receiver for signature verification, and
read whether the comparison is constant time. Deeper doctrine on third-party
trust and integrity: `doctrine/09-dependency-supply-chain.md`.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 03.10.1 | Third-party responses are validated against an expected schema before use | V5.1 | | |
| 03.10.2 | Integration data reaching a query, template, or filesystem path is treated as untrusted | V5.3 | | |
| 03.10.3 | Webhook and callback payloads have their signature verified before processing | V13.2 | | |
| 03.10.4 | Signature comparison is constant time | V6.2 | | |
| 03.10.5 | Outbound calls have timeouts and bounded response sizes | V13.1 | | |
| 03.10.6 | Redirects from third-party endpoints are not blindly followed | V12.6 | | |
| 03.10.7 | Integration failure is handled closed, not by proceeding with partial data | V1.1 | | |

---

## Common false positives

| Looks like | Often is not | How to tell |
|---|---|---|
| A handler in `A minus B` | Authorized by a scoped repository, a base class, or a query filter you did not read | Open the data access layer. If the query is scoped by caller identity, it is in set B |
| An unguarded route | Guarded by middleware registered at the router or the group | Read the registration and the ordering. The decorator on the function is not the whole story |
| A whole-body bind | Safe, if the model has an explicit allowlist of settable fields | Read the model. An allowlist at the model layer is a valid control |
| An unauthenticated route | Deliberately public: health, metadata, reference data | Ask what it returns. Public is a decision, not automatically a defect |
| Reflected CORS origin | Validated against a fixed set before being echoed | Read the validation. Reflection after an allowlist check is fine |
| A missing rate limit | Present at the gateway or edge, invisible in the tree | You usually cannot confirm this from code. Unverified, not clean |
| A third-party response used directly | Constrained to a value the code then validates or maps | Follow it to a sink. No dangerous sink, no finding |
| An old version prefix in routes | Removed from the deployed surface | The tree cannot tell you. This is API9 and it is unverified by construction |

The recurring shape: the inverted search produces a candidate set, and the
candidate set is not a finding list. Everything in it is a question. Rule 2 is
what turns a question into a finding, and it will delete most of the set.

## Notes on severity

Score impact and reachability independently and read `rubrics/scoring.md`. The
category name is filing, not severity.

Notes specific to this surface:

- **API1** typically lands Severe impact and Authenticated reachability, which
  the matrix scores High. Do not inflate it to Critical because the object
  happens to be interesting. Do not deflate it because the identifier is a UUID:
  unpredictability is not an access control, and the reachability axis is about
  preconditions, not about guessing.
- **API6** resists the matrix, because impact is a function of volume rather
  than of a single request. Score the achievable outcome at the scale the flow
  permits, and say in the finding that no individual request is defective. A
  reader who checks one request and finds it correct will otherwise dismiss it.
- **API9** is unverified by construction more often than not. Info, honestly
  stated, with a named question for someone with deployment access. Do not
  manufacture a severity for a surface you cannot see.
- **API3** outbound findings depend entirely on who can call the endpoint. The
  same over-exposed field is Low behind a role you confirmed and High on an
  endpoint any authenticated user reaches. Trace the caller set before you
  score it.
