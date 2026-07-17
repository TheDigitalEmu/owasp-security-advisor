# 11. Incident Response

**Doctrine ID:** `11-incident-response`
**Mode:** review
**Source standards:** OWASP incident response guidance, OWASP ASVS 5.0 logging and error handling chapter, the NIST incident handling guide (SP 800-61)

---

## Purpose

This is process doctrine. It assesses one question: could the owner of
`<target-repo>` actually detect, contain, and recover from a compromise of this
application? It informs the recommendations section of the report. It does not
produce findings against the code, with one class of exception noted below.

Say that to the user early, because a reader who finds an incident response
section in a code review will otherwise assume you audited their operations,
and you did not. What you can assess from the tree is whether the engineering
preconditions for a response exist. That is most of what decides the outcome.

## Principles

1. **Preparation is the only phase you can do in advance, and therefore the
   only one worth assessing during a code review.** Detection, containment,
   eradication, and recovery happen under time pressure with incomplete
   information. What determines how they go was decided months earlier, in
   code, by people not thinking about incidents.

2. **A plan that has never been executed is a document, not a capability.** The
   revocation endpoint nobody called, the restore nobody ran, the kill switch
   nobody flipped: each is an assumption wearing the costume of a control. The
   first execution always finds something, and 3am during an active compromise
   is an expensive time to find it.

3. **Some IR failures are design decisions, made at build time, and those are
   legitimate code findings.** A token that cannot be revoked is not an
   operational gap. It is a property of the code, visible in the code, and the
   consequence lands during an incident. File it.

4. **The response capability is bounded by the log.** Everything downstream of
   detection depends on knowing what happened. Without the record there is no
   response, only speculation dressed as a timeline.

## Review procedure

The six questions below are the ones a code reviewer can genuinely answer from
the tree and the infrastructure definitions. They are why this file exists in a
code review skill.

### Question 1: Can you tell what happened?

`doctrine/10-logging-monitoring.md` is the full assessment. The IR reading of
it is narrower:

- Is there a record of the events that would constitute the incident?
- Is it retained long enough to cover the dwell time of a realistic intrusion?
- Does it survive compromise of the host it was written on?
- Can a human search it under pressure, or does it need the one person who
  knows the query language?

Without the log there is no response. There is a rebuild, a hope, and a
statement to users that cannot be made honestly because nobody knows what was
touched. That last one is a regulatory problem as well as an engineering one.

### Question 2: Can you revoke?

Every credential, session, and token needs a kill path, and someone needs to
have actually run it. Check, in the code:

- Can a single user session be invalidated server-side, by an administrator,
  now?
- Can all sessions for one user be invalidated at once? This is what you need
  after a password reset during a takeover, and it is frequently absent.
- Can an API key or service credential be revoked without a deploy?
- Can an OAuth grant or refresh token be revoked?
- Is there a path to invalidate everything for everyone at once? A blunt
  instrument, and some days it is the right one.

Cross-reference `doctrine/13-auth-and-session.md` on stateless tokens. A
self-contained signed token is valid until it expires, by design, and the
server holds no state that could stop it. If the only revocation is "wait for
expiry", containment time is fixed by a configuration value chosen for user
convenience, and during an incident it is not negotiable.

If you cannot revoke a token, you cannot contain a compromise. That design
decision is an incident response finding, made at build time, and it is visible
in the token verification path, as are the mitigations that sometimes exist
(short lifetimes plus a refresh path, or a revocation list checked at
verification). Read the verification code and see which is true. Do not accept
the design document's word for it (Rule 3).

### Question 3: Can you rotate?

Cross-reference `doctrine/08-secrets-and-config.md`. The IR question is not
"where are the secrets", it is "what happens when one is burned". For each
secret class in the inventory:

- Is there a documented rotation procedure, and does it need a deploy, a
  restart, or downtime?
- Can old and new values be valid at once, or is rotation a hard cutover that
  breaks in-flight work? A hard cutover means rotation is an outage, which
  means it does not happen, which means it will not happen during the incident
  either.
- Is the secret shared across environments or tenants? A shared secret is a
  rotation that touches everything at once.

A secret nobody can rotate is an incident with a delay on it. The delay is
however long it takes someone to find it and try.

### Question 4: Can you isolate?

Containment means removing the affected thing without taking the product down,
because "take the product down" gets escalated, argued about, and deferred
while the attacker is still inside.

- Feature flags or kill switches on individual capabilities, and whether they
  are evaluated at request time or read once at startup. A flag that needs a
  restart is not a kill switch.
- The ability to disable a single integration, endpoint, or background job.
- The ability to lock a single account, or a single tenant.
- Whether the application degrades or dies when a component is removed. If
  disabling the compromised component takes down authentication, it will not be
  disabled.

### Question 5: Can you rebuild?

Cross-reference `doctrine/09-dependency-supply-chain.md`. Eradication needs a
known-good artifact and confidence that the rebuild does not reinstate the
compromise.

- Are builds reproducible from a source commit and a lockfile?
- Are known-good artifacts retained, and identifiable as known-good?
- Can infrastructure be recreated from a definition in the repository, or is
  the running state the only copy?
- If the compromise entered through the build pipeline, does rebuilding from
  that pipeline reproduce it? This is what makes provenance an IR control
  rather than a compliance checkbox.

### Question 6: Can you tell users?

Cross-reference `doctrine/18-privacy-and-data-protection.md`.

- Do you know what data was in the compromised store? A data inventory you
  cannot produce during an incident is one you do not have.
- Can you determine which records were accessed, rather than which could have
  been? The difference between notifying four hundred people and notifying
  everyone is this question, and the access log answers it or nothing does.
- Is there a route to the affected people, on a channel that does not run
  through the compromised system?
- Are the regulatory deadlines known, and is the clock understood to start at
  awareness rather than at confirmation?

## The phases, briefly

Not a textbook chapter. The parts that matter to a code reviewer are the
preconditions above.

- **Detection.** Question 1 and `doctrine/10-logging-monitoring.md`. Realistically
  detection is external: a researcher, a customer, or a partner tells you. That
  makes `doctrine/19-vulnerability-disclosure.md` an incident response control.
- **Containment.** Questions 2 and 4. Stop the bleeding without destroying the
  evidence. These two goals conflict directly; see below.
- **Eradication.** Questions 3 and 5. Remove the access, not the symptom.
  Rotating the credential but leaving the shell is the classic failure and buys
  the attacker a quiet week.
- **Recovery.** Question 5, plus confidence that what you restored is not what
  was compromised. A backup taken after the initial access restores the access.
- **Lessons learned.** Optional in practice, and the only phase that changes
  the next incident. Assessing it is outside a code read.

## Roles and the on-call path

Assess at the level of "does one exist, and has anyone tested it". You cannot
audit an organisation from a repository, and you should not pretend to.

- Is there a named owner for a security incident in this application?
- Is there an on-call route that reaches a human out of hours, and does the
  alerting from `doctrine/10-logging-monitoring.md` terminate at it or at an
  inbox?
- Has the path been tested end to end, with someone confirming the page
  arrived?

If none of this is visible in the tree, say so and mark it unverified per Rule
2. Inferring an organisation's on-call maturity from its code is not review.

## Communication

Four audiences, different obligations, and the failure mode is treating them as
one.

- **Internal.** If the incident channel is inside the compromised system, there
  is no incident channel.
- **Users.** What happened, what data, what they should do. Late and accurate
  beats early and wrong, but "we are investigating" on day one beats silence.
- **Regulators.** Deadlines are short, start at awareness, and do not pause
  while engineering works. Cross-reference
  `doctrine/18-privacy-and-data-protection.md`.
- **The reporter.** If the incident arrived through a disclosure, the reporter
  is a participant, not a nuisance. Cross-reference
  `doctrine/19-vulnerability-disclosure.md`. How they are treated determines
  whether the next finder reports it or sells it.

## Evidence preservation

Every incident hits this in the first hour and the instinct is wrong. Service
is down or untrusted, a clean image is minutes away, and the pressure to
restore comes from everyone at once. Rebuilding the host destroys the only
record of how they got in. Without the compromised host you cannot determine
the entry vector, so you cannot know whether the rebuild reinstates it, so the
second incident is the same as the first. Organisations that skip preservation
routinely get compromised again through the same door within weeks.

What makes this tractable is decided in advance, and some of it is visible in
the infrastructure definitions:

- Can a host or container be snapshotted and detached rather than terminated?
- Is there capacity to bring up a replacement without reusing the instance?
- Are logs already shipped, so the host's disk is not the only copy?

Three yeses and the tension dissolves: isolate, snapshot, replace, investigate
the snapshot. Otherwise the organisation chooses service over evidence under
pressure with no good option available. That is a preparation finding for the
recommendations.

## Backups as an IR control

Two questions matter, and neither is "do backups exist".

**Has a restore been tested?** An untested backup is a hypothesis. First
attempts commonly find the backup was of the wrong thing, excluded a critical
store, is unreadable, or takes four days against a four-hour recovery
objective. Each is discovered at the worst possible moment. A backup nobody has
restored is an intention, not a control.

**Can the attacker who owns your production also reach your backups?** Read the
credential grants and the network path. If the production service account can
write to or delete from the backup store, ransomware reaches the backups
through the door it already used. An online, writable, credential-reachable
backup is not a backup against ransomware. It is a second copy that gets
encrypted eight seconds after the first.

What makes it a control: offline, immutable for a retention window, or in a
separate trust domain whose credentials production does not hold. Note which is
true, and whether immutability is enforced by the storage layer or by a policy
revocable with the credentials the attacker now holds.

## Tabletop exercises

Outside a code read, but it converts the document into the capability. A
tabletop costs an afternoon and is the only assessment that reliably finds the
gap between the written plan and the executable one: the runbook naming a
decommissioned service, the owner who left, the fact that nobody knows who can
revoke production credentials at 2am on a Sunday.

If a runbook is in the tree, note whether it references things that still
exist. Whether it has ever been exercised is not visible; say so and hold it at
Info.

## Checklist

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 11.1 | Security-relevant events are recorded well enough to reconstruct an incident | V7.2 | | |
| 11.2 | Log retention exceeds a realistic intrusion dwell time | V7.3 | | |
| 11.3 | Logs survive compromise of the host that produced them | V7.3 | | |
| 11.4 | A single user session can be invalidated server-side without a deploy | V3.3 | | |
| 11.5 | All sessions for one user can be invalidated in one action | V3.3 | | |
| 11.6 | API keys and service credentials can be revoked without a deploy | V3.3 | | |
| 11.7 | Stateless tokens have a revocation path, or a lifetime short enough to serve as one | V3.5 | | |
| 11.8 | The revocation path has been executed at least once, not merely written | V3.3 | | |
| 11.9 | Every secret class has a documented rotation procedure | V14.1 | | |
| 11.10 | Rotation does not require downtime, and permits old and new values concurrently | V14.1 | | |
| 11.11 | Secrets are not shared across environments or tenants | V14.1 | | |
| 11.12 | Individual capabilities can be disabled at request time without a restart | V14.1 | | |
| 11.13 | A single account or tenant can be locked | V3.3 | | |
| 11.14 | Disabling a compromised component does not take down authentication or the product | V14.1 | | |
| 11.15 | Builds are reproducible from a source commit and a lockfile | V14.1 | | |
| 11.16 | Known-good artifacts are retained and identifiable | V14.1 | | |
| 11.17 | Infrastructure can be recreated from a definition in the repository | V14.1 | | |
| 11.18 | A data inventory exists that names what is in each store | V1.8 | | |
| 11.19 | Access to sensitive records is logged specifically enough to scope a notification | V7.2 | | |
| 11.20 | A contact route to affected users exists outside the application itself | V1.8 | | |
| 11.21 | A named owner for a security incident in this application exists | V1.1 | | |
| 11.22 | An out-of-hours on-call route exists and alerting terminates at it | V7.4 | | |
| 11.23 | The incident communication channel does not depend on the application | V1.1 | | |
| 11.24 | Regulatory notification deadlines are known and start at awareness | V1.8 | | |
| 11.25 | A disclosure route exists for external reporters | V1.1 | | |
| 11.26 | A host can be snapshotted and isolated rather than terminated | V1.1 | | |
| 11.27 | Backups exist for every store that holds state the product needs | V1.1 | | |
| 11.28 | A restore has been tested, with a recorded date and duration | V1.1 | | |
| 11.29 | The production service account cannot delete or overwrite backups | V14.1 | | |
| 11.30 | Backups are offline, immutable, or in a separate trust domain | V14.1 | | |
| 11.31 | Backup immutability is enforced by the storage layer, not by revocable policy | V14.1 | | |
| 11.32 | A runbook exists and references only components that still exist | V1.1 | | |
| 11.33 | The incident plan has been exercised at least once | V1.1 | | |

## Notes on severity

Most of this file produces recommendations, not findings. Say so in the report
rather than manufacturing severities to make the section look substantive.

Two things here are genuine findings and score normally against
`rubrics/scoring.md`, because they are properties of the code rather than of
the organisation:

**No revocation path for a credential or token.** A design decision visible in
the verification code. Impact is the impact of the compromise it fails to
contain, usually Severe. Reachability is that of the thing that cannot be
revoked. It belongs in the findings tree, cross-filed with
`doctrine/13-auth-and-session.md`.

**Backups reachable and writable by the production service account.** Visible
in the credential grants and the infrastructure definition. Impact
Catastrophic, since it converts a contained compromise into total data loss.
Reachability is that of the production credential. If you read the grant, score
it. If you inferred it from a naming convention, Rule 2 puts it at Info.

Everything else here (no tested restore, no on-call, no tabletop, no runbook)
is a preparation gap a code read cannot verify, and the verification ceiling
holds it at Info. That is the right answer and not a weak one. Put it in the
recommendations with the consequence stated plainly: these decide whether a bad
day is a bad day or a bad quarter, and none of them can be bought once the
incident has started.
