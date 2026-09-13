# 10. Logging and Monitoring

**Doctrine ID:** `10-logging-monitoring`
**Mode:** review and build
**Source standards:** OWASP Top 10 2025 A09 (Security Logging and Alerting Failures, renamed from the 2021 Security Logging and Monitoring Failures), OWASP ASVS 5.0 logging and error handling chapter, OWASP Logging Cheat Sheet, OWASP Logging Vocabulary Cheat Sheet

---

## Purpose

This doctrine covers whether `<target-repo>` records enough to know it was
attacked, records it in a form that survives the attacker, and puts it in front
of someone in time to matter. It also covers the inverse failure, which is more
common: logging so much that the logs are themselves a breach.

A09 is the category that never shows up in a scanner and never gets a
proof-of-concept, and is therefore the one most likely to be skipped. Skipping
it is how a three-day incident becomes a three-month one.

## Principles

1. **Logging has three purposes with three different requirements, and
   conflating them is why most logging is useless.** Detection needs low
   latency and low volume. Investigation needs completeness and retention.
   Evidence needs integrity and provenance. A single log stream designed for
   none of them serves all three badly.

2. **Debug logging is a fourth thing and it is not any of these.** It is
   written for the author, at the moment of authorship, and it is the single
   largest source of credentials in log stores. It is not security logging and
   it must not be counted as coverage.

3. **Logs are the most widely replicated and least access-controlled datastore
   in most organisations, and they outlive the data they describe.** They get
   shipped to an aggregator, indexed, backed up, replicated to a warm standby,
   and read by everyone on call. A field you would not put in the primary
   datastore without encryption does not become safe by being in a log line.

4. **A log nobody alerts on is not detection.** It is evidence, at best, and
   only if it survives. The distinction is not pedantic: the control the
   organisation believes it has is detection, and it does not have it.

5. **Absence is the finding, which means the search runs backwards.** You
   cannot grep for a log call that is not there. This category is the one place
   in the review where the method must be inverted, and if you review it
   forwards you will find nothing and conclude everything is fine.

## Review procedure

### Step 1: Establish what logging exists at all

Before judging coverage, find the mechanism:

- What logging library or facility is in use, and is there one or several?
- Is there a structured logger, or string concatenation into stdout?
- Is there a distinct security or audit log, separate from the application log?
- Where does output go: stdout, a file on the host, a socket, an aggregator?
- Is there a documented log format, and does the code follow it? (Rule 3: read
  the calls, not the format document.)

Record the mechanism. Every subsequent judgement depends on it.

### Step 2: Assess the field set

For each security-relevant log call, check that it carries the fields that make
a line useful. The OWASP Logging Vocabulary Cheat Sheet names these; in short:

- **When.** A timestamp with an explicit timezone or in UTC, from a
  synchronised clock. Local time with no offset is unusable the moment a second
  host joins, and correlating across drifting clocks is guesswork.
- **Who.** The subject, and the actor separately if they differ. An
  administrator acting on a user's account is two identities, and a line with
  one of them cannot answer the question it exists for.
- **What.** The event type, from a fixed vocabulary, not a free-text sentence
  someone will reword next sprint, breaking every query built on it.
- **Where.** Source address, entry point, component. Behind a proxy, confirm
  the source address comes from a header the proxy actually sets and strips, or
  it is attacker-controlled and worse than absent.
- **Outcome.** Success or failure, explicitly. A failure that logs the same
  line as a success is not a log.

A log line that says only "error" is a wasted write. It costs storage and index
budget, it will be read once during an incident by someone who then has to go
and read the code anyway, and its existence makes the coverage number look
better than the coverage is.

### Step 3: Coverage, checked backwards (the A09 technique)

This is Phase 5 of `doctrine/06-investigation-playbook.md` and it cannot be
grepped forwards.

1. Take the security-relevant event list from the threat model (step 2 of the
   procedure in `SKILL.md`). Not a generic list. The events that matter for
   this application's assets and adversaries.
2. For each event, locate the code path that performs it.
3. From that path, search for a log call. Follow the wrappers. A call to an
   audit helper is not evidence that a line is written; read the helper (Rule
   2), and confirm it is not conditional on a flag that is off.
4. Report the events with no log call. Those are the findings.

The events that must be covered, at minimum:

| Event class | Why it matters |
|---|---|
| Authentication success | Establishes the baseline. Without it, a successful compromise looks like normal use |
| Authentication failure | The only signal for credential attacks |
| Authorization failure | The clearest single indicator of an account probing beyond its scope |
| Session lifecycle: creation, renewal, expiry, invalidation | Distinguishes a stolen session from a new login |
| Privilege and role changes | The step an attacker takes after they get in |
| Credential changes: password, key, token | Account takeover is usually visible here first |
| MFA changes: enrolment, removal, recovery use | MFA removal is a takeover signal and is routinely unlogged |
| Access to sensitive data | The thing you will be asked about, by someone external |
| Administrative actions | The highest-impact actions, and the ones with no other record |
| Input validation failures at a security boundary | Individually noise, in aggregate the earliest signal there is |
| Rate limit trips | The attack is already in progress by the time these fire |

Cross-reference `doctrine/13-auth-and-session.md` for the auth and session
events, and `doctrine/17-rate-limit-abuse.md` for the abuse signals. The
control belongs to those files; the record of it belongs here.

### Step 4: Prohibited content

Now search forwards, because here presence is the finding. Look through every
log call, particularly the debug ones, for:

- Passwords, in any form, including a request body logged whole.
- Tokens, API keys, bearer credentials, and the `Authorization` header.
- Session identifiers. A logged session id is an account takeover with a
  logging pipeline as the delivery mechanism, and everyone on call has access.
- Cryptographic key material.
- Full payment card data, and anything that reconstructs it across lines.
- Personal data beyond what the stated purpose requires.

Search the idioms that cause this directly: logging an entire request or
response object, logging an exception with its full context, serialising a
whole user record, and dumping a configuration object at startup. Each logs a
structure whose contents will change later without anyone revisiting the log
call, so this is not a bug that stays fixed unless redaction lives in the
logger. A redaction policy that depends on every author remembering it has
already failed, and you are looking at the code where they forgot.

Cross-reference `doctrine/18-privacy-and-data-protection.md` for what personal
data may be recorded and for how long, and `doctrine/08-secrets-and-config.md`
for the secret classes that must never reach a log.

### Step 5: Log injection

Untrusted data landing unencoded in a log that something downstream parses is
an injection sink like any other, and it is treated as one nowhere.

Check three outcomes:

1. **Forged lines.** Newlines in attacker-controlled input let the attacker
   write their own log entries. If the log is evidence, the evidence is now
   attacker-authored and nobody can tell which lines are real.
2. **Broken parsers.** Unescaped delimiters, quotes, or control characters
   break the aggregator's parse. A field that reliably breaks ingestion makes
   specific events invisible: a deliberate technique, not an operational
   nuisance.
3. **Stored XSS through the log viewer.** The payload sits in the log until an
   operator opens the viewer, then executes in a privileged internal tool. This
   is real and under-appreciated: the log viewer is an internal tool nobody
   reviewed, it is often exempted from the CSP work done on the product, and
   its users hold the highest privilege in the organisation.

Structured logging with a real serialiser fixes all three, because the encoding
happens once, in the library. String concatenation fixes none of them.

### Step 6: Correlation identifiers

Check that a single identifier follows a request across every component it
touches, and that it appears on every line those components write.

Without one, investigation is archaeology. The investigator has a timestamp and
a source address and must reconstruct which of the four hundred lines in that
second belong to the request they care about, across services whose clocks
disagree. It is doable, it takes days, and it is the reason incidents that
should take hours take weeks.

Two things to verify beyond its existence:

1. It is generated at the trust boundary, at the outermost entry point, and
   propagated inward. Generated per-service means it correlates nothing.
2. If it is accepted from an inbound header, it is validated and length-bounded
   before use, and it is not trusted as evidence of anything. A client-supplied
   correlation id is a convenience for tracing and an injection vector for the
   log store. Both are true at once.

### Step 7: Integrity and shipping

- Is the log append-only from the application's perspective?
- Is it shipped off the host, and how promptly?
- Can the application's own service account modify or delete log entries? If it
  can, then anything that compromises the application can erase the record of
  the compromise.
- Who can read the log store, and is that access itself logged?

An attacker who can edit logs on the host they compromised has erased the
investigation. This is why shipping matters more than retention: a log retained
for two years on the host that was owned is worth less than a log shipped
within seconds to somewhere the compromised host cannot write. Retention is a
policy question. Shipping is an architecture question, and it is the one that
decides whether the policy means anything.

### Step 8: Retention

Establish the retention period, and check that it is a decision rather than a
default.

The trade-off is real and has no clean answer. Breaches are typically found
months after the initial access, so ninety-day retention often means the
investigation cannot see the intrusion at all, only its consequences. Retaining
for years bounds nothing and turns the log store into a growing archive of
personal data with weaker access control than the system it describes, which is
exactly what `doctrine/18-privacy-and-data-protection.md` says not to build.

Name the trade-off. A defensible answer usually separates the streams: a
minimal, low-sensitivity security event stream retained long, and a verbose
application stream retained short. One stream serving both is the finding, and
the reason both purposes are served badly.

### Step 9: Monitoring and alerting

Coverage is not detection. Check the last hop:

1. Does anything alert on the security events, or are they only queryable?
2. Which events alert? Authentication failure spikes, authorization failure
   patterns, privilege changes, and MFA removal are the minimum worth arguing
   for.
3. Does the alert reach a human on call, or an inbox, or a muted channel?

Alert fatigue is a real failure mode and must be reported as one. An alert that
fires constantly gets a filter rule within a fortnight, after which the
organisation has a detection control on paper and none in practice. An alert
everyone mutes is worse than no alert: no alert is at least honestly
represented on the risk register, while the muted one creates a false belief in
coverage, and false belief is what gets the incident missed.

If you can read the alerting configuration, read it. If you cannot, this is
outside a code read: say so, mark it unverified, hold it at Info per Rule 2.
The boundary of the review is not an embarrassment.

### Step 10: Error handling

The split matters: generic to the user, detailed to the log.

- Does the user-facing error path leak stack traces, framework versions, query
  fragments, or internal hostnames? Check the default error handler, and check
  whether the production configuration actually differs from the development
  one, in the deployed configuration rather than in the file that says it does.
- Is the detailed information logged, or only shown? Showing a stack trace to
  the user and not logging it is the worst arrangement available: the attacker
  gets the diagnostic and the defender does not.
- Cross-reference `doctrine/08-secrets-and-config.md` on verbose errors.

### Step 11: Swallowed exceptions

Grep for empty catch blocks, catch blocks that only continue, and catch blocks
whose only body is a comment. Then read each one.

A catch block that logs nothing is a blind spot with a comment on it. Some are
legitimate: an expected, benign, control-flow exception that happens by design
is fine and does not want a log line. Most are not. The ones on a security
boundary, around a permission check, a signature verification, a token parse,
or a decryption, are findings, because a failure that is silently swallowed
becomes an allow, and nobody sees the attempt.

The specific pattern to hunt: a verification that throws on failure, wrapped in
a catch that continues to the success path. That is an authentication bypass
with a logging finding attached, and it should be filed under
`doctrine/13-auth-and-session.md` with the missing log noted here.

## Checklist

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 10.1 | A logging mechanism exists and is used consistently across `<target-repo>` | V7.1 | | |
| 10.2 | A security or audit log is distinguishable from the application log | V7.2 | | |
| 10.3 | Log calls use a structured logger rather than string concatenation | V7.3 | | |
| 10.4 | Timestamps carry an explicit timezone or are UTC, from a synchronised clock | V7.1 | | |
| 10.5 | Log lines record the subject, and the actor separately where they differ | V7.2 | | |
| 10.6 | Event types come from a fixed vocabulary, not free text | V7.2 | | |
| 10.7 | Log lines record source address and entry point | V7.2 | | |
| 10.8 | Source address behind a proxy is derived from a header the proxy sets and strips | V7.2 | | |
| 10.9 | Log lines record outcome (success or failure) explicitly | V7.2 | | |
| 10.10 | Authentication success is logged | V7.2 | | |
| 10.11 | Authentication failure is logged | V7.2 | | |
| 10.12 | Authorization failure is logged | V7.2 | | |
| 10.13 | Session creation, renewal, expiry, and invalidation are logged | V7.2 | | |
| 10.14 | Privilege and role changes are logged | V7.2 | | |
| 10.15 | Credential changes are logged | V7.2 | | |
| 10.16 | MFA enrolment, removal, and recovery use are logged | V7.2 | | |
| 10.17 | Access to sensitive data is logged | V7.2 | | |
| 10.18 | Administrative actions are logged | V7.2 | | |
| 10.19 | Input validation failures at a security boundary are logged | V7.2 | | |
| 10.20 | Rate limit trips are logged | V7.2 | | |
| 10.21 | Credentials and passwords never reach a log call | V7.1 | | |
| 10.22 | Tokens, API keys, and authorization headers never reach a log call | V7.1 | | |
| 10.23 | Session identifiers never reach a log call | V7.1 | | |
| 10.24 | Key material never reaches a log call | V7.1 | | |
| 10.25 | Full payment data never reaches a log call, including across lines | V7.1 | | |
| 10.26 | Personal data in logs is limited to what the logging purpose requires | V7.1 | | |
| 10.27 | Redaction is implemented in the logging layer, not at call sites | V7.1 | | |
| 10.28 | Whole request, response, exception, and config objects are not logged wholesale | V7.1 | | |
| 10.29 | Untrusted data is encoded before it reaches a log that is parsed | V7.3 | | |
| 10.30 | Newlines in untrusted input cannot forge log entries | V7.3 | | |
| 10.31 | The log viewer treats log content as untrusted when rendering | V7.3 | | |
| 10.32 | A correlation identifier spans services and appears on every line | V7.2 | | |
| 10.33 | The correlation identifier is generated at the trust boundary, not accepted from the client unvalidated | V7.2 | | |
| 10.34 | Logs are append-only from the application's perspective | V7.3 | | |
| 10.35 | Logs are shipped off the host promptly | V7.3 | | |
| 10.36 | The application's own service account cannot delete or edit shipped logs | V7.3 | | |
| 10.37 | Read access to the log store is restricted and is itself logged | V7.3 | | |
| 10.38 | Retention is a stated decision, with the investigation/privacy trade-off named | V7.3 | | |
| 10.39 | Security events alert a human, not only a queryable store | V7.4 | | |
| 10.40 | Alert volume is low enough that alerts are not routinely muted or filtered | V7.4 | | |
| 10.41 | User-facing errors are generic and leak no stack trace, version, or internal identifier | V7.4 | | |
| 10.42 | The production error configuration is confirmed in the deployed config, not the source default | V7.4 | | |
| 10.43 | Detail suppressed from the user is present in the log | V7.4 | | |
| 10.44 | No empty catch block sits on a security boundary | V7.4 | | |

## Common false positives

| Looks like a finding | Why it often is not | How to tell |
|---|---|---|
| No log call at the handler | The logging may be in middleware, a filter, or a decorator that runs for every route | Read the middleware chain before reporting absence (Rule 2). This is the most common false positive in this category |
| A field named `token` in a log line | It may be an opaque correlation identifier, a request id, or a non-secret public claim | Read what populates it. Do not report on the field name |
| Verbose logging in a development configuration | It never runs in production | Confirm the production configuration actually differs, in the deployed config. If you cannot see the deployed config, it is unverified and Info |
| An empty catch block | Some exceptions are expected, benign, and part of control flow | Read what throws and what the catch skips. On a security boundary it is a finding; on a cache miss it is not |
| "No SIEM in the repo" | The aggregator and its alerting are infrastructure, not application code | Outside a code read. Mark unverified, hold at Info, and say what would settle it |
| Logging the request body on a webhook receiver | It may be a deliberate, documented, retention-bounded capture for replay | Check for redaction and a retention bound. If both exist, it is a decision. If neither does, it is a finding |
| A password field appearing in a logged object | The logger may redact by field name at serialisation | Read the serialiser configuration. If redaction is by an explicit field list, check the list is current with the model |
| Log lines with no user identifier on an unauthenticated endpoint | There is no identity to record yet | Correct as-is. The source address and correlation id are the identity here |

## Notes on severity

Score against `rubrics/scoring.md`. Three things specific to A09.

**Missing logging is almost never Critical on its own, and the pressure to
inflate it is strong.** Absent detection does not itself grant an attacker
anything: impact is Minor to Moderate, and reachability is usually Theoretical,
because exploiting it requires an attacker already doing something else. That
lands at Low or Info and that is correct. What missing logging does is multiply
the cost of every other finding, and the honest place to say so is the
recommendations section and the finding text, not an inflated severity. A
report that files "no audit log" as a Critical has told the reader that its
severities are rhetoric.

**Secrets in logs price as the secret, not as a logging issue.** A session
identifier or a live credential written to a store that the whole engineering
organisation can read is a disclosure of that credential, and it scores exactly
as `doctrine/08-secrets-and-config.md` would score it, with reachability set by
who can read the log store. Read that access control before you rate it, and if
you cannot, hold it at Info as unverified rather than guessing high.

**Log injection scores as the sink it reaches.** Forged lines are an integrity
finding of Moderate impact. Stored XSS in the log viewer is scored as the XSS
it is, against the privilege of the operators who use the viewer, which is
usually the highest privilege in the system. Do not file it as a logging
finding at Low because the entry point happens to be a log line.
