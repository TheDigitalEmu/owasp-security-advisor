# 15. Database and Data Access

**Doctrine ID:** `15-database-access`
**Mode:** review and build
**Source standards:** ASVS 5.0 (encoding and sanitization, validation and
business logic chapters), OWASP Top 10 2021 A03 (Injection), OWASP SQL Injection
Prevention Cheat Sheet, Query Parameterization Cheat Sheet, Injection Prevention
Cheat Sheet

---

## Purpose

This doctrine covers how `<target-repo>` constructs queries, what privileges it
holds when it runs them, and what protects the data once it is at rest. It fires
on any review of anything that talks to a datastore.

Injection is a solved problem that keeps happening, because the solution
(parameterisation) covers the part of the query everyone thinks about and does
not cover the parts they do not. Spend your time on the parts it does not cover.

## Principles

1. **Parameterisation is the only real control.** The query text and the data
   travel to the datastore separately, so no value can change the query's
   structure. Everything else here is a way of achieving that, or a compensation
   for not achieving it.

2. **Escaping is a fallback and it is fragile.** It is version, encoding,
   charset, and context dependent. An escape function correct in one context is
   wrong in another, and a connection charset change can silently invalidate it.
   Where you find escaping, the finding is not necessarily "this is exploitable";
   it is "the control here is the wrong one, and its correctness cannot be
   established by reading this line".

3. **String building with user data is the defect, whatever the escaping.** Do
   not litigate whether a particular escape call is sufficient. Report the
   concatenation. Proving exploitability raises severity; failing to prove it
   leaves a real defect at whatever ceiling the evidence supports.

4. **Injection is a class, not a SQL fact.** The same shape (untrusted data
   becoming part of an interpreted instruction) recurs across query languages,
   templates, shells, directory protocols, and expression evaluators. A reviewer
   who searches only for SQL idioms finds only SQL bugs, and modern applications
   have fewer of those and more of the others.

5. **An ORM in the dependency manifest is not evidence of safety.** It is
   evidence that safe defaults are available. The escape hatches exist because
   somebody needed them, and the person who needed them is the person who wrote
   the finding. Sweep for the hatches by idiom (Rule 2 and Rule 3), not by
   trusting the abstraction.

6. **Absence of an error message is not absence of injection.** Generic error
   handling hides the symptom, not the defect. It is a good practice that makes a
   bad practice invisible.

---

## Parameterisation, and what it cannot cover

Parameters bind values. They do not bind identifiers or syntax. These parts of a
query **cannot** be parameterised by any driver:

| Part | Why it matters |
|---|---|
| Table name | Dynamic table selection from client input reaches every table the account can see |
| Column name | Common in "sort by any column" and dynamic filter builders |
| Sort direction | `ASC` / `DESC` looks harmless, and is a concatenation point |
| `ORDER BY` generally | The most common real injection point in modern code |
| `LIMIT` and `OFFSET` | Parameterisable on some drivers, not all. Do not assume |
| Set membership lists | An `IN` list built by joining values, rather than one placeholder per value |
| Schema or catalogue qualifiers | The table name problem, one level up |

The control for all of these is a **strict allowlist mapping client input to a
fixed set of known-good values**. Not an escape. Not a regular expression that
rejects some characters. Not a check that the value "looks like an identifier". A
map from an input token to a literal string constant in the source, with a default
that rejects rather than passes through.

The passthrough anti-pattern to sweep for: a validator confirms the input is
alphanumeric, and the validated input is concatenated in directly. That is not an
allowlist. It is a denylist wearing an allowlist's clothes, and it fails the
moment the column set is not the thing being constrained.

**This is where the injection actually is.** Everyone parameterises the `WHERE`
clause, because that is the example in every tutorial. Nobody allowlists the
`ORDER BY`, because sorting feels like presentation rather than data. Search the
sort and filter builders first. That is where the yield is.

---

## ORMs and query builders

What an ORM parameterises by default: values passed to its expression API, values
bound into its generated statements, values in its standard finder methods. That
is genuinely most of the query surface, and it is why ORM-heavy codebases have
fewer classic injection defects.

What it does not cover, swept for by idiom:

- **Raw query escape hatches.** Every ORM has one, usually named for rawness or
  for the query language itself. The hatch is not a defect; a hatch taking an
  interpolated string is. Find every call site and read each one.
- **Expression fragments accepting strings.** Methods taking a condition, select,
  join, having, or group fragment as text. These sit inside the fluent API and
  look like safe ORM usage. They are string concatenation with better syntax
  highlighting.
- **`where` variants taking raw predicates.** The distinction between the
  structured form and the raw-string form is often one character of API surface
  and no visual difference at the call site.
- **Ordering and pagination helpers taking a column name from input.** The ORM
  cannot know the string came from a request. See the previous section.
- **Aggregate, function, and cast expressions built from strings.**
- **Migrations and administrative scripts**, which frequently bypass the ORM
  entirely and run with higher privileges. They are in scope.

Having found a hatch, apply Rule 2: trace the value's provenance back to an entry
point before asserting reachability. A raw query built from a constant, or from a
value that can only come from configuration, is not a finding. Say so and move on.

---

## Stored procedures

A stored procedure confers no safety by itself. The question is what is inside it.
A procedure that builds a statement from its own parameters and executes it
dynamically is injectable through the procedure, and the calling application code
will look perfectly clean.

If the target uses procedures, read them. If you cannot (they live in the
datastore, not in `<target-repo>`), that is a scope boundary: record it in
`<findings-root>/unverified.md` as an area not reviewed, and do not imply the
procedure layer was cleared.

---

## The injection class, generically

Sweep for each. Name the class, not a product.

| Class | The shape | Where it hides |
|---|---|---|
| Query-language injection, relational | Untrusted data becomes query syntax | Sort builders, dynamic filters, raw hatches |
| Query-language injection, document datastores | An operator object arrives where a scalar was expected, changing the predicate's meaning | Handlers passing a parsed request body into a query filter |
| Query-language injection, graph datastores | Untrusted data becomes traversal syntax | Query strings built for a graph engine, which usually have no ORM at all |
| Query-language injection, search and analytics engines | Untrusted data becomes a query clause or a scripted field | Search endpoints forwarding a client query fragment |
| Template injection | Untrusted data becomes template source, not template data | Templates compiled from a string including input: user-editable templates, subject lines, generated reports |
| Command injection | Untrusted data reaches a shell or a process spawn | Export, conversion, archive, and image-processing helpers |
| Directory-service injection | Untrusted data becomes a directory filter | Authentication against a directory, group lookups |
| Expression-language injection | Untrusted data is evaluated as an expression | Rule engines, dynamic validation, configurable business logic, spreadsheet-like features |
| Header and log injection | Untrusted data carries a delimiter into a parsed format | Response header construction, structured log fields |

The document-datastore case defeats the usual instinct and deserves a note. No
string is being concatenated, so the code looks safe. The defect is that the
request body was parsed into a structure and that structure was handed to the
query layer, so a client sending an operator object instead of a scalar rewrites
the predicate. The control is type validation at the boundary: assert the value is
a scalar of the expected type before it reaches the query. Sweep for handlers
passing a whole parsed body, or an un-narrowed field from it, into a filter.

---

## Least privilege at the datastore

Read the account the application connects as, and answer:

- **Does it hold DDL rights it does not need?** An application that never creates
  a table at runtime should not be able to drop one. Migrations should run as a
  different account, from a different process, at a different time.
- **Does it hold rights over the whole schema, or only what it uses?** If one
  injection defect on one endpoint yields every table, including the credential
  store and the audit log, the blast radius of every other finding here just went
  up.
- **Is it a superuser or the schema owner?** Frequently yes, because that is what
  the setup guide said. Frequently unexamined.
- **Can it read the audit trail?** If so, an attacker with a query primitive reads
  what you logged about them. If it can write the trail, they edit it. See
  `doctrine/10-logging-monitoring.md`.
- **Is there a separate read-only account for read-only paths?** Rarely, but ask.
- **Does it hold rights over other applications' schemas** on a shared instance?

Least privilege does not prevent injection. It caps what injection is worth, which
is exactly the argument for it, and also why a privilege finding rides alongside
an injection finding rather than replacing it.

---

## Row-level and tenant isolation

Isolation enforced at the datastore is a genuine and strong control, because it
survives the handler nobody added a check to. It is also frequently **available
and not enabled**, which produces the worst outcome: the reviewer sees the feature
in the schema, assumes it is on, and clears a whole class.

To verify it is on, not merely available:

1. Read the policy definitions and confirm policies exist **per table**, not just
   on the tables somebody remembered. Enumerate the tables, enumerate the tables
   with a policy, diff them. This is the inverted search from Phase 5 of
   `doctrine/06-investigation-playbook.md`.
2. Confirm the enforcement flag is enabled on each table. That is a separate
   setting from the policy existing.
3. Confirm the application's account is **subject** to the policy. Owners and
   superusers commonly bypass it silently, which makes the policies decorative in
   production while appearing correct in the schema.
4. Confirm the identity the policy keys on is set on the connection for each
   request, and cannot be set by the client. A policy keyed on a session variable
   the application forgets to set on a pooled connection enforces against whatever
   the previous request left behind.
5. Confirm pooling does not leak that identity across requests.

If you cannot verify points 2 through 5 from code in `<target-repo>` (they may be
live datastore state), mark the control unverified. Do not credit it, and do not
assume the application-layer checks are redundant because of it.

---

## Mass assignment at the data layer

Covered from the authorization side in `doctrine/13-auth-and-session.md`. The
data-layer angle is distinct:

- A model or entity binding every column from a supplied structure, with no
  allowlist of writable fields.
- An update built from the keys of a request body, so the writable column set is
  whatever the client sends.
- A create path accepting a primary key from the client, allowing an overwrite of
  an existing row or a collision with a reserved identifier.
- An allowlist expressed as a denylist of protected fields, so every new column is
  writable by default. Read which way round it is. This is the difference between
  a control that decays safely and one that decays open.

---

## Data at rest

Three questions, in order. The third is the one that matters.

1. **What is encrypted?** Enumerate the columns holding credentials, tokens,
   personal data, and financial data, then enumerate which are encrypted. Diff.
   See `doctrine/18-privacy-and-data-protection.md` for what counts as sensitive.
2. **How?** An authenticated cipher mode, with a random per-record nonce that is
   never reused. Not a mode that leaks equality across records, which turns an
   encrypted column into a searchable one and defeats the point for
   low-cardinality fields.
3. **Where does the key live?** A key stored beside the data is not a control. A
   key in the same datastore as the ciphertext, in the same repository as the
   code, or in an environment file shipping in the same image as the database
   backup, reduces encryption at rest to obfuscation against exactly one threat
   (raw disk theft) and nothing else. Say that plainly. Follow the key to its
   source. Cross-reference `doctrine/08-secrets-and-config.md`.

Also ask whether the field should be encrypted or hashed. A value the application
must read back needs encryption. A value it only ever compares needs hashing.
Encryption of something that should be hashed is a design defect (see
`doctrine/13-auth-and-session.md`). Hashing of something that must be read back is
a bug that gets "fixed" by someone adding a plaintext column.

---

## Connection handling

- **Credentials.** Where they come from, whether they are in the repository, the
  image, or the history. Full treatment in `doctrine/08-secrets-and-config.md`;
  the finding is filed there, but you find it, because you are the one reading the
  connection setup.
- **TLS to the datastore.** Enabled, and with certificate verification actually
  on. A connection string that enables TLS but disables verification can be
  impersonated by any host on the path. The disable flag is usually one option
  with a reassuring name. Read the options, not the fact that TLS appears.
- **Pooling.** Connections are reused across requests, so anything set on a
  connection (a session variable, a role, a temporary table, a search path) can
  outlive the request that set it. If the isolation model depends on a per-request
  session variable, confirm it is set on checkout and cleared on return. This is a
  quiet, high-impact class, and it is invisible under single-user testing.
- **Connection string construction.** If any part is built from input, including a
  host or a database name, that is its own injection surface into the driver's
  option parser.
- **Timeouts and pool limits.** A missing statement timeout turns one expensive
  query into an availability finding. See `doctrine/17-rate-limit-abuse.md`.

---

## Blind and time-based injection

Generic error handling is good practice. It also means the reviewer and the
attacker both stop seeing the evidence, and only one of them stops.

- **Absence of an error message in the response is not absence of injection.** An
  injection that changes a result set, a row count, a redirect, a response length,
  or a response time is exploitable without ever producing an error.
- A boolean-differential channel exists wherever a query result changes anything
  observable, including "found" versus "not found". A time channel exists wherever
  the datastore can be made to wait, which is everywhere.
- Practically: **do not clear an injection candidate because the endpoint returns a
  generic error.** Clear it by reading the query construction. The construction is
  the evidence; the response is not. This skill does not send traffic (SKILL.md
  section 9), so the code read is the only evidence available anyway.
- Conversely, do not raise severity because errors are verbose. That is a separate,
  smaller finding about error handling.

---

## Second-order injection

Input arrives, is stored safely through a parameterised write, and is later read
back out and concatenated into a query. The write is clean. The read is clean. The
concatenation is nowhere near the entry point, often in a different module, often
in a background job or a report. A single-hop trace from the entry point misses it
entirely.

How to find it:

1. Start from the **sinks**, not the entries (the backwards search from the
   playbook's search technique section). Enumerate every dynamic query
   construction, then ask of each interpolated value: where did it come from?
2. Treat "it came from the datastore" as **untrusted** until you have traced how it
   got there. Data stored by an earlier request is attacker input with a delay.
3. Pay specific attention to paths that read stored data and build queries:
   reporting, exports, scheduled jobs, admin tooling, search index builders,
   migration and backfill scripts. These are written fastest, reviewed least, and
   run with the highest privileges.
4. The same shape applies beyond queries: stored data rendered into a template,
   passed to a command, or written into a structured log is the same defect in a
   different class.

The mental model: **trust does not attach to a storage location.** A value is
trusted because of where it came from and what validated it, not because it made a
round trip through a table.

---

## Review procedure

1. **Inventory the data access layer.** Which library, which version, whether there
   is an ORM, whether there is more than one path to the datastore. Rule 3: read
   the manifest, do not recall it.
2. **Enumerate the query sinks** (Phase 3 of
   `doctrine/06-investigation-playbook.md`). Every place a string reaches the
   datastore, including the ORM's raw hatches, migration scripts, background jobs,
   and anything in a maintenance or tooling directory.
3. **Sweep for concatenation and interpolation at those sinks**, by idiom rather
   than by name: format strings, template literals, join operations building
   clauses, string addition adjacent to a query verb.
4. **Sweep the parts that cannot be parameterised, specifically and separately.**
   Sort builders, dynamic column selection, dynamic table selection, `IN` list
   construction. For each, find the allowlist. A validator instead of an allowlist
   is a candidate finding.
5. **Trace provenance backwards** for each candidate to a real entry point. A query
   built from a constant is not a finding. Rule 2 applies before anything leaves
   Info.
6. **Run the isolation verification** above as an enumerate-and-diff, not by eye.
7. **Read the connection setup**: account, privileges, TLS and its verification
   flag, pooling, and any per-connection state the security model relies on.
8. **Run the second-order sweep** from the sinks backwards. A separate pass, not
   folded into step 5, because step 5's instinct is to stop at "it came from the
   database".
9. **Read the encryption-at-rest key source** and follow it to where the key
   actually lives.
10. **Refute.** For each surviving candidate: is the driver actually
    parameterising here; does this ORM method escape by default in this version; is
    the value genuinely attacker-controlled; is the path reachable in the deployed
    configuration. Unanswered means unverified means Info.

---

## Checklist

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 15.1 | Every query reaching the primary datastore uses parameter binding for all values | V1, V5 | | |
| 15.2 | No query is constructed by concatenating or interpolating request-derived data | V5 | | |
| 15.3 | Escaping is not relied on as the primary injection control anywhere | V5 | | |
| 15.4 | Dynamic table names map through a strict allowlist to source constants | V5 | | |
| 15.5 | Dynamic column names map through a strict allowlist to source constants | V5 | | |
| 15.6 | Sort direction maps through an allowlist, not a validated passthrough | V5 | | |
| 15.7 | `ORDER BY` clauses are built from allowlisted values only | V5 | | |
| 15.8 | `LIMIT` and `OFFSET` are bound, or range-validated as integers | V5 | | |
| 15.9 | Set membership lists generate one placeholder per value, not a joined string | V5 | | |
| 15.10 | Every ORM raw-query escape hatch call site was enumerated and read | V5 | | |
| 15.11 | No ORM expression fragment (select, join, having, group, raw predicate) is built from input | V5 | | |
| 15.12 | Migration, backfill, and maintenance scripts are in scope and free of built queries | V5 | | |
| 15.13 | Stored procedures were read and contain no dynamic statement construction, or the gap is recorded as unreviewed | V5 | | |
| 15.14 | Document-datastore queries validate that request values are scalars of the expected type before use as predicates | V1, V5 | | |
| 15.15 | Graph, search, and analytics query construction is parameterised or allowlisted | V5 | | |
| 15.16 | No template is compiled from a string containing untrusted data | V5 | | |
| 15.17 | No untrusted data reaches a shell or process spawn | V5 | | |
| 15.18 | Directory-service filters are constructed with escaping appropriate to that protocol, or avoided | V5 | | |
| 15.19 | No untrusted data is evaluated as an expression by a rule or expression engine | V5 | | |
| 15.20 | Untrusted data written to headers or structured logs cannot carry a delimiter | V5 | | |
| 15.21 | The application datastore account holds no DDL rights it does not use at runtime | V1 | | |
| 15.22 | Migrations run as a separate account from the runtime account | V1 | | |
| 15.23 | The application account is not a superuser or schema owner | V1 | | |
| 15.24 | The application account cannot modify or delete the audit trail | V1 | | |
| 15.25 | Row-level or tenant isolation policies exist on every table holding tenant-scoped data (enumerate and diff) | V1, V8 | | |
| 15.26 | Isolation enforcement is enabled per table, not merely defined | V1, V8 | | |
| 15.27 | The application's account is subject to the isolation policies and does not bypass them | V1, V8 | | |
| 15.28 | The identity the isolation policy keys on is set server-side per request and cannot be set by the client | V8 | | |
| 15.29 | Per-connection state the security model depends on is set on checkout and cleared on return | V1 | | |
| 15.30 | Model binding uses an allowlist of writable fields, not a denylist of protected ones | V1 | | |
| 15.31 | Create paths do not accept a client-supplied primary key | V1 | | |
| 15.32 | Sensitive columns were enumerated and each is encrypted or justified as not requiring it | V6 | | |
| 15.33 | Encryption at rest uses an authenticated mode with a unique per-record nonce | V6 | | |
| 15.34 | The encryption key does not live in the same store, repository, or image as the data | V6 | | |
| 15.35 | Values that are only ever compared are hashed rather than encrypted | V6 | | |
| 15.36 | Datastore credentials are not in the repository or its history (file under `doctrine/08-secrets-and-config.md`) | V14 | | |
| 15.37 | TLS to the datastore is enabled AND certificate verification is not disabled | V9 | | |
| 15.38 | No part of the connection string is built from request-derived input | V5 | | |
| 15.39 | Statement and connection timeouts are set | V1 | | |
| 15.40 | No injection candidate was cleared on the basis of a generic error response | V5 | | |
| 15.41 | Second-order sweep completed: every dynamic query's interpolated values traced to origin, including values read from the datastore | V5 | | |
| 15.42 | Data read from the datastore is treated as untrusted at every sink, not only at the entry point | V5 | | |

---

## Common false positives

| Looks like a finding | Why it may not be | How to tell |
|---|---|---|
| A format string next to a query verb | The interpolated value may be a source constant or a configuration value | Trace the value backwards to its origin. Constant in, no finding. Say so |
| A raw query hatch call | The hatch is not the defect, the built string is | Read the call. Literal text with bound parameters is correct usage of a correct API |
| Concatenation building a query, found by grep, callers unread | Reachability is unknown, so the ceiling applies (`rubrics/scoring.md`, worked example C) | Trace the callers. Until then it is Info and unverified. Do not file it as Critical because the shape is alarming |
| A validator upstream of a concatenated identifier | A validator constrains characters; it does not constrain the value to a known-good set | If the set of permitted outputs is not finite and enumerated in source, it is still a finding. If it genuinely is (a map lookup), it is clean |
| Isolation policies present in the schema | Present is not enabled, and enabled is not applied to an owner account | Check the enforcement flag and the account's bypass status. If you cannot, mark unverified rather than clearing it |
| An ORM in the manifest | Evidence of availability, not of use | Sweep the hatches. The ORM's presence says nothing about the file that did not use it |
| A query built in a migration script | Reachability is Constrained or Theoretical if it only runs from a controlled process with controlled input | Read where its input comes from. If it takes an argument from an operator, that is a different and smaller finding |
| An unencrypted column holding an identifier | Not everything needs encrypting, and encrypting an identifier you must query on has a real cost | Judge against `doctrine/18-privacy-and-data-protection.md`. Do not file "not encrypted" without saying what the exposure is |
| A prepared statement whose text was built first | The trap. The statement is prepared, so it looks parameterised, but the structure was already fixed by the concatenation | Read how the statement text was produced, not whether a prepare call was made |
| A generic error handler on a query path | Good practice, not a defect | It is a reason to disbelieve your own negative result, not a finding in itself |
| Injection reachable only by an administrator | A privileged role reduces Reachability, it does not clear the finding | Score Reachability as Constrained and file it. Administrators get phished |

---

## Notes on severity

Score against `rubrics/scoring.md`; do not re-derive it here. The mappings that
recur in this area:

- **A verified injection reachable unauthenticated** is Catastrophic impact at
  Open reachability. Critical. Grade caps at F. This holds even where the
  application account is least-privileged, because a query primitive plus time is
  usually enough to find a way up.
- **A verified injection behind authentication** is Catastrophic impact at
  Authenticated reachability, so still Critical under the matrix. Do not discount
  injection for being post-login; a query primitive does not care which session
  found it.
- **The same defect behind a privileged role** is Constrained, so High. Say who
  holds that role, and if you do not know, say that instead of assuming the
  discount.
- **An over-privileged datastore account with no injection found** is a
  defence-in-depth gap: Minor impact, Theoretical reachability, so Info to Low. Its
  real function in the report is as a multiplier note on every injection finding,
  so cross-reference it rather than inflating it.
- **Isolation available but unverified** is exactly what the verification ceiling
  is for. Hold it at Info, state what would settle it (reading the enforcement
  state and the account's bypass status in the live schema), and do not let the
  application-layer findings be discounted against a control you did not confirm.
- **An encryption key stored beside the data** is not "encryption present". Score
  it as if the encryption were absent, and say so, because a reader who sees
  "encrypted at rest" in a summary will draw a conclusion the evidence does not
  support.
- **Second-order findings** score on the sink, not the entry. The impact is
  whatever the sink does. The reachability is whatever it takes to get the value
  stored, which is often trivially Open.
