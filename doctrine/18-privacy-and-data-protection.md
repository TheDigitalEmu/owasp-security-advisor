# 18. Privacy and Data Protection

**Doctrine ID:** `18-privacy-and-data-protection`
**Mode:** review and build
**Source standards:** ASVS 5.0 data protection chapter, OWASP Top 10 2025 A04
(Cryptographic Failures), OWASP Privacy Risks (Top 10), OWASP User Privacy
Protection Cheat Sheet, OWASP Logging Cheat Sheet

---

## Purpose

This doctrine covers personal data: what `<target-repo>` collects, where it
comes to rest, who it is handed to, how long it survives, and whether the code
can actually delete it. It fires on any application that touches data about
people, which is nearly all of them.

**This is an engineering checklist, not a legal assessment.** It tells you
whether the code does what a data protection obligation would require. It does
not tell you which obligations apply, and it is not legal advice. A legal
determination needs a lawyer. Where this file mentions legal weight, it means
only that a category tends to carry statutory consequence, so the engineering
bar is higher.

---

## Read this before you fill anything in

**The inventory table in this file ships empty, and in this repository it stays
empty.**

A completed data inventory is a map of what to steal. It names every store
holding personal data, what is in each, and how sensitive each is. It is the
reconnaissance document an attacker would write first.

**Copy the template into the engagement's findings root and fill it in there:**

```
<findings-root>/data-inventory.md
```

Confirm that path is git-ignored before writing to it. Then treat the filled
copy as sensitive: it inherits the classification of the most sensitive data it
describes, which by construction is the most sensitive data in the system.

This mirrors `doctrine/08-secrets-and-config.md`, for the same reason. If you
are an agent and you are about to write a real table name, field name, store,
or retention period into **this** file, stop.

---

## Principles

1. **You cannot protect what you have not enumerated.** Every failure this
   doctrine catches is downstream of somebody not knowing the data was there.
   Inventory before judgement. Rule 3.
2. **Data minimisation is a security control, not a compliance chore.** The
   record you never collected cannot leak, cannot be mishandled by a processor,
   and cannot appear in a breach notification. It is the only defence that
   survives total compromise of the application, and the only one that gets
   cheaper over time. "Why do we collect this" is a security question.
3. **Deletion is a claim about every copy, and most code makes it about one.**
   The primary store is the easy copy.
4. **Personal data in logs is the failure that sprawls.** It gets designed
   correctly and leaks anyway. It has its own section.
5. **Access control on personal data is an authorization problem wearing a
   privacy hat.** Cross-reference `doctrine/13-auth-and-session.md`. If any
   authenticated user can read any other user's record, this doctrine has
   nothing to add: it is an authorization finding, scored as one.
6. **Consent is state that gates a code path, or it is theatre.** A banner that
   records a click while the tag fires regardless is not a control, it is
   evidence of intent to have one.

---

## Review procedure

### Step 1: Build the data inventory

Enumerate, by reading, every place personal data comes to rest. Follow the
idioms, not the word "personal":

- Schema definitions, migrations, model classes. Read the field names.
- Request bodies and form definitions: what does the client actually send?
- Caches, including anything holding a serialised user object.
- Search indexes. A full denormalised copy, forgotten by every deletion path
  ever written.
- Queues and event streams. A message containing a user record persists for the
  retention of the topic, which is longer than anyone thinks.
- Analytics and telemetry payloads.
- Log sinks. Every one.
- Backups, snapshots, read replicas.
- Exports, reports, any file the application generates.
- Third-party processors: every SDK, tag, pixel, error reporter, support
  widget, session recorder.
- Client-side storage. It is a store, it is unencrypted, and it persists.

Record what class of data each holds. Fill the copy in `<findings-root>/`,
never here.

### Step 2: Classify

- **Public.** Deliberately published. No obligation beyond integrity.
- **Internal.** Not personal, not public.
- **Personal.** Identifies or relates to a person, directly or in combination.
  Includes identifiers that look technical: IP addresses, device identifiers,
  cookie IDs, and account numbers are personal data in most regimes, and the
  team will not think of them that way.
- **Sensitive personal.** Health, biometric, financial, government identifier,
  sexuality, religion, political opinion, union membership, precise location,
  and data about children.

**The sensitive categories carry legal weight in most jurisdictions and they
change the severity ceiling.** As an engineering matter: do not score a finding
touching a sensitive category the same as the equivalent finding on a display
name. Name the category in the finding so the reader can take it to someone
qualified to judge the exposure.

Note the combination problem: fields individually innocuous are personal in
aggregate. A postcode, a birth date, and a gender is not three harmless fields.

### Step 3: Minimisation

For every field, ask what breaks if it is not collected. Ask it especially of
fields that arrived because a form template had them, which is most of them.
Then ask it of retained copies: does the analytics event need the user ID or a
rotating pseudonym? Does the log line need the record or the identifier?

Findings here are real. "We collect a government identifier and never read it"
is breach exposure with no upside, and it outranks several things that look
more technical.

### Step 4: Retention and deletion

Establish per store the retention period and the mechanism enforcing it. A
retention policy nobody implemented is not a retention period.

Read the deletion path hostilely. **Be blunt: in most codebases, "delete" sets a
flag.** Soft delete is a visibility change. It is a reasonable pattern and it is
not deletion. If the system promises erasure and implements a flag, the gap
between the promise and the code is the finding.

For a deletion claiming to be real, confirm by reading:

- **Primary store**: hard delete, or flag?
- **Replicas**: they follow, but confirm.
- **Backups.** The hard one. A backup taken before deletion contains the
  record, and restoring resurrects it. The honest answers are a bounded expiry
  window, or a suppression list applied on restore. "We will remember" is not an
  answer, and nobody will.
- **Caches.** Keyed on what? Invalidated by the delete, or expiring on their own
  schedule?
- **Search indexes.** Almost always missed. Read for an index removal. Usually
  absent, and the record stays fully searchable.
- **Analytics pipelines.** Data that left for a warehouse is rarely reached by
  an application's delete.
- **Log lines.** Not achievable without scrubbing at write time or a retention
  window short enough to bound it. This is the strongest argument for step 5.
- **Third-party processors.** Each either has a deletion API or it does not.
  Read for the call. Its absence is a finding.

The test for any claimed erasure: after this path runs, what is left, and
where? If the answer requires a human to remember something, it is not
implemented.

### Step 5: Personal data in logs

Cross-reference `doctrine/10-logging-monitoring.md` for what logs must contain.
This is what they must not.

Logs are the worst place for personal data, and it is not close:

- **They sprawl further than any datastore.** Files, an aggregator, a SIEM, a
  cloud log service, somebody's laptop during an incident.
- **They are retained longer**, sometimes for compliance reasons that conflict
  directly with a deletion obligation.
- **They are replicated to third parties** by default in most stacks.
- **They are read by more people with fewer controls.** Aggregator access is
  routinely granted to every engineer and rarely audited at the record level.
  Data that needed a role to read in the application needs nothing in the logs.

Read for it specifically: request body logging (especially on the error path,
which is where someone wanted the body); full object dumps; exception messages
and traces carrying arguments; anything logged from an authentication or
profile handler; structured logging that serialises a whole model. If a
redaction layer exists, read its field list and ask what happens to a field
added next week. A redaction allowlist fails safe; a denylist fails as soon as
the schema changes, which it will.

### Step 6: URLs, referrers, and analytics

- **URLs and query strings.** A URL is written to server logs, proxy logs, CDN
  logs, browser history, and the `Referer` sent to every third party on the
  page. Personal data or a token in a query string is in all of them. A record
  ID is usually fine; a government identifier, token, or email address is not.
- **Referrer header.** Check the policy. Without a restrictive one, the full URL
  leaks to every external resource the page loads.
- **Analytics payloads.** Read what is sent, not what the analytics plan says. A
  page URL containing a token is a token sent to the vendor.

### Step 7: Third-party sharing and processors

**Every SDK, tag, pixel, and error reporter is an export of personal data.**
Each is a transfer. Being added by a frontend build step does not change that.

- Enumerate them from page templates and the dependency manifest. Cross-
  reference `doctrine/09-dependency-supply-chain.md`: a third-party script has
  both a supply chain and a privacy dimension, and they are separate findings.
- **Error reporters routinely ship request bodies off-site.** This is the
  default in several popular reporters: the whole request, including whatever
  the user typed, sent to a vendor, retained on their schedule, readable by
  anyone with project access. Read the scrubbing configuration. If there is
  none, the default is what is happening.
- Session recorders capture the DOM, so they capture the form being typed into.
  Read the masking configuration.
- Per processor: what leaves, is it minimised, is there a deletion path, and
  does it fire only after consent where consent gates it?

### Step 8: Encryption

TLS everywhere, including internal hops and hops to processors. At rest,
present, with the key held somewhere other than next to the data. Cross-
reference `doctrine/08-secrets-and-config.md` for the configuration surface.

State the honest limit, because at-rest encryption is routinely cited as though
it answered a question it does not: **it defends against a stolen disk, and
against nothing else that matters here.** It does not defend against a
compromised application, because the application holds the key and the attacker
who has the application has the key. It does not defend against injection, a
broken authorization check, a leaked backup shipped with its own key, or an
insider with query access. Every one of those returns plaintext.

So "the database is encrypted at rest" is not a mitigating control for any
finding in this doctrine except physical theft of media. Do not let it modulate
a severity. Field-level encryption with a key the application does not hold at
rest is a stronger claim; read the key handling before believing it.

### Step 9: Subject rights as an engineering surface

Access, export, correction, erasure. Each is a code path or a promise somebody
will have to keep manually.

**If there is no code path for erasure, that is a finding, not a policy gap.**
The distinction matters because policy gaps get routed to a document owner and
never come back. Report it as engineering work: no function does this, so when
the request arrives someone will do it by hand, inconsistently, against the
primary store only, missing every copy in step 4. The same applies to export.

Read the authorization on these paths. An erasure endpoint with a weak check is
an account destruction primitive; an access or export endpoint with one is a
bulk exfiltration primitive that helpfully assembles everything about a person
into a single download. These are the two places where a privacy feature
becomes the most attractive endpoint in the application. Score them from
`doctrine/13-auth-and-session.md`.

### Step 10: Consent

Where consent gates a processing activity, read the gate.

- Is consent checked before the code path runs, or recorded and ignored? The
  common implementation is a banner that writes a row and a tag that fires on
  page load regardless.
- Are tags loaded conditionally on consent, or loaded always and told to
  behave? "Loaded but configured not to send" is a vendor's promise executing in
  your page with your users' data in scope.
- Is refusal as easy as acceptance, and does refusal actually withhold?
- Is the state versioned, so a change in what is consented to invalidates it?
- Is it per-purpose, or one switch for everything?

### Step 11: Pseudonymisation versus anonymisation

- **Pseudonymised**: identifiers replaced, re-identification possible with
  additional information. Still personal data. Still in scope for this file.
- **Anonymised**: re-identification not reasonably possible. Out of scope.
  Rarely achieved.

**Most data described as anonymised is pseudonymised.** Hashing an identifier
does not anonymise it: the hash is stable, so it still links every record for
that person, and if the input space is small (an email address, a phone number,
a government identifier) it is trivially reversed by enumeration. A salted hash
with the salt in the same system is the same thing with an extra step.

Re-identification from quasi-identifiers is routine, not theoretical. A handful
of fields (a date, a location, an age, a timestamp) is frequently enough to
isolate an individual. Test any claim of anonymisation: what else would I need
to link this back, and is it available? If the answer is "another table in the
same system", it is pseudonymised.

### Step 12: Breach readiness

**You cannot notify on what you cannot enumerate.** In jurisdictions with a
statutory breach notification duty, the obligation turns on what was in the
compromised store, so an incident response that starts with "what was in there"
starts too late. The step 1 inventory is the artifact that answers it, which is
the second reason to build one.

Cross-reference `doctrine/11-incident-response.md`. The engineering questions:
is there logging sufficient to establish which records were accessed (cross-
reference `doctrine/10-logging-monitoring.md`), and is the inventory current
enough to trust? An access log recording that an endpoint was hit but not which
records were returned cannot answer the only question that will matter.

---

## Data inventory template

**Copy to `<findings-root>/data-inventory.md` before filling in. Leave the copy
in this file blank. A filled inventory is a map of what to steal.**

| Data class | Classification | Store class | Purpose | Source | Retention | Deletion mechanism | Processors it reaches | Verified how |
|---|---|---|---|---|---|---|---|---|
| *(class of data, not a field name)* | *(public / internal / personal / sensitive personal)* | *(primary store, cache, index, queue, log sink, backup, client storage)* | *(why it is collected)* | *(user-supplied, derived, third-party)* | *(period, or "none defined")* | *(hard delete / soft delete / none)* | *(classes of processor)* | *(file read, or unverified)* |

Name the **class** of every store and processor, never the vendor. The class is
what makes the finding portable. The vendor name is what makes the document
dangerous.

---

## Checklist

Evidence column stays blank until you have read the code. Rule 3.

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 18.1 | A data inventory exists, is current, and lives outside this repo | 8.1 | | |
| 18.2 | Every store holding personal data is enumerated, including caches, indexes, and queues | 8.1 | | |
| 18.3 | Data is classified, and sensitive categories are identified explicitly | 8.1 | | |
| 18.4 | Every collected field has a stated purpose | 8.1 | | |
| 18.5 | Fields collected without a purpose are identified as findings | 8.1 | | |
| 18.6 | Retention periods are defined per store and enforced by code, not policy | 8.1 | | |
| 18.7 | Deletion is real in the primary store, or the soft delete is disclosed accurately | 8.3 | | |
| 18.8 | Deletion propagates to replicas, caches, and search indexes | 8.3 | | |
| 18.9 | Backup expiry bounds the survival of deleted records, or a suppression list is applied on restore | 8.3 | | |
| 18.10 | Deletion propagates to every third-party processor holding a copy | 8.3 | | |
| 18.11 | Personal data is not written to logs, and the redaction layer is an allowlist | 7.1 | | |
| 18.12 | Request bodies are not logged on the error path | 7.1 | | |
| 18.13 | Exception messages and traces do not carry personal data to a sink or vendor | 7.1 | | |
| 18.14 | Personal data and tokens do not appear in URLs or query strings | 8.2 | | |
| 18.15 | A restrictive referrer policy is set | 8.2 | | |
| 18.16 | Analytics payloads are read and confirmed free of personal data and tokens | 8.2 | | |
| 18.17 | Every SDK, tag, pixel, and reporter is enumerated as a data export | 8.2 | | |
| 18.18 | The error reporter's scrubbing configuration is read and confirmed | 7.1 | | |
| 18.19 | Session recording and DOM capture tools mask input fields | 8.2 | | |
| 18.20 | TLS is enforced on every hop, including internal and to processors | 9.1 | | |
| 18.21 | Personal data is encrypted at rest with the key held separately | 6.2 | | |
| 18.22 | At-rest encryption is not cited as mitigation for application-level findings | 6.2 | | |
| 18.23 | Access to personal data is authorized per record, not per role only | 4.1 | | |
| 18.24 | A code path exists for subject access | 8.1 | | |
| 18.25 | A code path exists for export in a portable form | 8.1 | | |
| 18.26 | A code path exists for correction | 8.1 | | |
| 18.27 | A code path exists for erasure, and it covers the stores in 18.8 to 18.10 | 8.3 | | |
| 18.28 | Subject rights endpoints are authorized as strongly as the data they expose | 4.1 | | |
| 18.29 | Consent state gates the code path, and is checked before processing runs | 8.1 | | |
| 18.30 | Tags and SDKs are loaded conditionally on consent, not loaded and configured | 8.1 | | |
| 18.31 | Consent is per-purpose, versioned, and refusable as easily as it is given | 8.1 | | |
| 18.32 | Claims of anonymisation are tested against re-identification, not accepted | 8.1 | | |
| 18.33 | Hashed identifiers are not described as anonymised | 8.1 | | |
| 18.34 | Access logging can establish which records were exposed, not only which endpoint was hit | 7.2 | | |
| 18.35 | Client-side storage of personal data is bounded and justified | 8.2 | | |

---

## Common false positives

| Looks like a finding | Why it may not be | How to tell |
|---|---|---|
| Soft delete | Only a finding if something promises erasure, or if retention has no other enforcement | Read what the product claims and read the purge job. Soft delete plus a purge that runs is a real deletion with a delay |
| An email address in a log line | In an authentication audit log, an identifier is required for the log to do its job | Cross-reference `doctrine/10-logging-monitoring.md`. The tension is real. A stable pseudonymous actor ID is usually the answer, but a considered decision to log the identifier is not a defect |
| An identifier in a URL path | An opaque record ID in a path is normal and usually fine | The finding is about data sensitive in itself: tokens, government identifiers, email addresses. A UUID in a path is not a privacy finding |
| No consent banner | Not every application processes anything requiring one, and this file does not tell you which do | The engineering finding is a consent mechanism that does not gate. Absence of a banner is a legal question this doctrine does not answer |
| Third-party analytics present | Presence is not a finding. Unconsented, unminimised, or undisclosed transfer is | Read what is sent and when it fires relative to consent state |
| No at-rest encryption | If the threat model excludes physical media access and the platform encrypts volumes anyway, marginal value is small | Confirm the platform behaviour rather than assuming. Do not file it as High reflexively; it defends against one specific thing |
| Personal data in a backup after deletion | Inherent to backups | The finding is unbounded backup retention with no suppression on restore. A bounded expiry window is a legitimate answer |
| A large data inventory | Collecting a lot is not itself a finding | The finding is a field with no purpose. Ask per field. "They collect a lot" is not reportable |

---

## Notes on severity

Score against `rubrics/scoring.md`. The mappings this area gets wrong:

- **The sensitive categories raise the ceiling.** The same defect is scored
  higher when the data is health, biometric, financial, a government
  identifier, precise location, or data about children. The impact axis does the
  work: disclosure of a sensitive category is not "information disclosure with
  no direct use", it is concrete harm to a person. Name the category.
- **Personal data exposed to unauthenticated access.** Impact Severe or
  Catastrophic depending on scale, reachability Open. **Critical** at scale.
  This is an authorization finding first; file it there and cross-reference.
- **Personal data in logs.** Impact follows sensitivity and breadth of log
  access. Reachability Constrained: it needs access to the sink. Typically
  **Medium**, **High** where the data is a sensitive category or the sink is a
  third party with broad internal access. Do not score it Theoretical because
  "you'd need log access". Log access is widely held; that is the point.
- **Request bodies shipped to an error reporter.** Reachability Constrained,
  impact follows what the bodies contain, which on an authentication handler is
  credentials. If credentials reach the reporter, that is also a secrets
  finding: cross-reference `doctrine/08-secrets-and-config.md`, where a
  credential in a third-party system is scored on blast radius.
- **No erasure path.** Impact Minor as a direct security matter, and that
  undersells it. This is a real defect with legal consequence under the
  applicable data protection regime, and this severity model is not built to
  price legal exposure. Score it honestly on the security axes (usually
  **Low**), and say plainly in the body that the security score is not the
  operative risk and that the exposure needs a qualified assessment. Do not
  inflate the severity to make it get attention. Write the sentence that makes
  it get attention.
- **Consent recorded but not gating.** Same shape: **Low** on the security axes,
  materially larger as an exposure. Same handling.
- **Claimed anonymisation that is pseudonymisation.** Severity follows what the
  mislabelling permits. If the "anonymised" dataset leaves the building, goes to
  a processor, or is exempted from deletion on the strength of the label, the
  finding inherits the severity of that handling.
- **Unverified by construction.** Much of this doctrine cannot be settled by
  code read: backup retention, processor behaviour, who can read the log
  aggregator. Those are `verified: false`, held at **Info** by the ceiling, and
  they belong in `unverified.md` with a note on what would settle each. That
  list is the honest boundary of the review.
