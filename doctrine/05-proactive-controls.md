# 05. Proactive Controls

**Doctrine ID:** `05-proactive-controls`
**Mode:** review and build
**Source standards:** OWASP Proactive Controls 2024

---

## Purpose

This doctrine is not a finding source. It is the framing for the Remediation
section of every finding and for the recommendations section of the report.
Where the Top 10 says what goes wrong, Proactive Controls says what to build
instead.

Say that plainly, because the failure mode is predictable: a reviewer treats
the control set as a checklist, walks the tree asking "does it do C1? does it
do C2?", and files ten findings saying the application lacks a control it was
never assessed against. That is noise. It buries the real findings and teaches
the reader to skim.

Findings come from `doctrine/04-web-top10-checklist.md`,
`doctrine/03-api-top10-checklist.md`, `doctrine/02-asvs-checklist.md`, and the
area-specific doctrine. This file tells you what to write in the Remediation
box once a finding already exists, and how to order the recommendations.

## Principles

1. **The control set is an answer key, not a question set.** You come here
   holding a defect and leave holding the control that would have prevented it.
2. **A remediation that fixes one call site is a patch. One that closes the
   class is a control.** Say which you are proposing. Both are legitimate.
   Pretending a patch is a control is not.
3. **Every remediation costs something.** Performance, compatibility, developer
   friction, operational burden, migration risk. Name it.
4. **You are advising, not deciding.** Make the trade-off legible rather than
   pre-resolving it in your favour and presenting the result as the only option.
5. **Recommendations are ordered by leverage, not severity.** The control that
   closes six findings outranks the fix for the worst one. This is the opposite
   of how findings are ordered, and it is deliberate.

---

## The control set

The Proactive Controls 2024 edition names ten controls, C1 to C10. If you cite
one and are not certain of its ordinal, **use the name and omit the number**. An
invented `C7` is a Rule 3 violation dressed as precision, and a reader who
catches one fabricated citation stops trusting every citation in the report.

### Implement access control

Authorization decided in one place, deny by default, on every request, using
the server's idea of the caller's identity and never the client's.

**Good:** move the ownership check out of the handler into the data access
layer, so every query for the resource type is scoped to the caller's tenant by
construction. A handler that forgets the check returns nothing, not everything.

**Bad:** "add an ownership check to this handler." True, but it fixes the one
handler you read and nothing for the four you did not.

### Use cryptography to protect data

Vetted algorithms, vetted implementations, keys that are managed and rotatable,
data classified before it is encrypted so you know what you are protecting and
from whom.

**Good:** encrypt the field with the platform's authenticated encryption
primitive, keyed from the key management service, versioned so rotation does
not require a backfill outage.

**Bad:** "encrypt the field." Keyed by what, held where, rotated how, and does
the threat model care? Encryption applied without naming the adversary usually
protects against one who was never coming.

### Validate all input and handle exceptions

Allow-list validation at the trust boundary, syntactic and semantic, plus error
handling that fails closed and does not leak internals to the caller.

**Good:** declare the request schema at the boundary and reject anything that
does not match before the handler runs. Handlers then receive typed, validated
structures and cannot be the place validation was forgotten.

**Bad:** "sanitise the input." Against which grammar, and what happens to input
that fails? A named helper is not a control until someone reads it.

The honest limit: input validation is defence in depth, not the control for
injection. Injection is stopped by correct query construction and correct
output encoding, which are context-specific and belong at the sinks.
Recommending validation as the fix for an injection finding is a common and
lazy error.

### Address security from the start

Threat modelling as a routine design input, security requirements written
before the code, decisions made while they are still cheap.

**Good:** rarely a code change. This belongs in the recommendations. If several
findings share a root cause of "nobody asked who the adversary was", say that
once, plainly.

**Bad:** telling a team that has already shipped to "threat model earlier".
True and useless. Name the decision that would have gone differently.

### Secure by default configurations

The safe path is the default path. Debug off, verbose errors off, permissive
CORS off, default credentials absent, the framework's own hardening not
switched off for convenience.

**Good:** change the default, and make the unsafe setting require an explicit,
named, logged override.

**Bad:** "set the flag to false in production config." Now production is right
and every other environment teaches developers the wrong default.

### Keep your components secure

You know what you depend on and at what version, you find out when one is
vulnerable, and you can ship an update without a project.

**Good:** pin via lockfile, generate an inventory, wire an alerting source so a
new advisory reaches someone. The capability to update is the control.

**Bad:** "upgrade to 2.4.1." Correct today, stale next month, and it does not
answer how the team finds out next time.

### Secure digital identities

Authentication strength matched to risk, credential storage using a memory-hard
hash, multi-factor where it matters, session lifecycle handled properly, and
account recovery treated as an authentication path rather than a convenience.

**Good:** delegate to the identity provider already in use rather than
maintaining a second credential store. Removing an auth implementation removes
a class of defect from the codebase.

**Bad:** "increase the iteration count." Fine, but if the finding was that
recovery resets any account without proving control of the address, iteration
count is not the topic.

### Leverage browser security features

The browser enforces a lot for free if you tell it to: Content Security Policy,
cookie attributes, framing controls, referrer policy, transport security.

**Good:** set the policy at the response layer for every response, in one
place, and treat a route needing an exception as a reviewable change. Headers
set per-handler are headers missing on the handler added next quarter.

**Bad:** proposing a header that mitigates an attack the application is not
susceptible to, and letting it sit above real findings. `rubrics/scoring.md`
worked example D is exactly this trap.

### Implement security logging and monitoring

The security-relevant events are recorded, the records are usable, they reach
somewhere a human or an alert looks, and they do not themselves become a
breach.

**Good:** emit authentication and authorization decisions as structured events
from the shared decision point, with actor, resource, verdict, and no
credential material. Logging from the choke point covers new handlers for free.

**Bad:** "add logging." To where, read by whom, retained how long, and what
happens when it fires at 3am?

### Stop server-side request forgery

When the application fetches a URL a caller influenced, the destination is
constrained by an allow-list, redirects are not followed blindly, and the
response is not handed back raw.

**Good:** route outbound fetches through a single client that resolves and
validates the destination against an allow-list, and refuses anything else.

**Bad:** "block internal IP ranges." A deny-list against a resolver an attacker
can influence. It fails to redirects, DNS rebinding, alternate encodings, and
whatever the cloud metadata endpoint looks like next year.

---

## Prefer the structural fix

A control that makes a whole class of defect impossible beats a patch at one
call site. This should be visible in the Remediation section of every finding.

| The instance | The class |
|---|---|
| Fix this one concatenation into a query | Make parameterised construction the only path to the driver |
| Add the missing authorization check to this handler | Centralise a deny-by-default decision every handler passes through |
| Escape this variable in this template | Encode by default in the template layer; make raw output an explicit, greppable opt-in |
| Validate this parameter in this endpoint | Validate at the boundary against a declared schema |
| Set the header on this response | Set it once at the response layer for every response |
| Bump this dependency | Build the capability to find out and to ship the bump |

When you write a Remediation, ask which column you are in and say so. "This
fixes the instance; the class fix is X, which is a larger change" is an honest
and useful sentence. Quietly proposing the instance fix and letting the reader
assume it closed the class is not.

**The honest counter-argument.** The structural fix has a larger blast radius.
It touches working code, it can regress behaviour nobody documented, it needs a
migration path, and it may be a quarter of work where the patch is an
afternoon. Sometimes the patch now plus the control later is correct,
especially when the finding is Critical and reachable today.

That is a trade-off, so it gets named, per
`doctrine/07-findings-template.md`. Say what the structural fix costs and what
the patch leaves open, then let the team decide. A reviewer who only ever
recommends the expensive option gets ignored on the cheap ones too.

---

## Naming the trade-off

A remediation with no cost stated reads as though the reviewer did not look for
one. Reviewers who never name costs get read as theorists, and their findings
get discounted at exactly the moment one of them is right.

- **Performance.** A memory-hard hash is memory-hard for you too. Per-request
  authorization lookups are per-request lookups.
- **Compatibility.** A stricter policy breaks an integration. A boundary schema
  rejects a client that has been sending a sloppy payload for two years.
- **Developer friction.** A control developers route around is not a control.
  If the safe path is harder than the unsafe one, the unsafe one wins and you
  have bought a false sense of coverage.
- **Operational burden.** Key rotation needs an owner. Alerts need someone to
  answer them. A control with no owner decays into one that is technically
  present.
- **Migration risk.** Backfilling encrypted data, re-hashing on next login,
  changing an identifier scheme. The interim state is often the vulnerable one,
  and it can last a long time.

One or two sentences. Not a cost-benefit essay. It is proof you thought about
what happens after someone says yes to you.

---

## Where each control is actually verified

Navigation, not assessment. The reviewer fills the right-hand columns during
the engagement; they ship blank.

| Control | Verified in | Applicable to `<target-repo>` | Evidence | Verdict |
|---|---|---|---|---|
| Implement access control | `doctrine/13-auth-and-session.md` | | | |
| Use cryptography to protect data | `doctrine/18-privacy-and-data-protection.md`, `doctrine/08-secrets-and-config.md` | | | |
| Validate all input and handle exceptions | `doctrine/15-database-access.md`, `doctrine/04-web-top10-checklist.md` | | | |
| Address security from the start | `doctrine/12-secure-code-review.md` | | | |
| Secure by default configurations | `doctrine/08-secrets-and-config.md` | | | |
| Keep your components secure | `doctrine/09-dependency-supply-chain.md` | | | |
| Secure digital identities | `doctrine/13-auth-and-session.md` | | | |
| Leverage browser security features | `doctrine/04-web-top10-checklist.md` | | | |
| Implement security logging and monitoring | `doctrine/10-logging-monitoring.md`, `doctrine/11-incident-response.md` | | | |
| Stop server-side request forgery | `doctrine/04-web-top10-checklist.md`, `doctrine/03-api-top10-checklist.md` | | | |

If a control is not applicable, say why in the Evidence column. "No outbound
fetch of a caller-influenced URL exists in this tree, confirmed by enumerating
the HTTP client call sites" is a real answer. Blank is not.

---

## Recommendations section shape

Findings are ordered by severity, because the reader needs to know what is
worst. Recommendations are ordered by **leverage**, because the reader needs to
know what to do on Monday. These produce different orders. That is the point.

Leverage is: how many findings this control closes, plus how many future
findings of the class it prevents, divided by what it costs.

```
## Recommendations

### 1. <Control, stated as a thing to build>

Closes: <finding IDs>
Prevents: <the class, named>
Cost: <one honest sentence>
Effort: <a rough shape, not a fake estimate>

<Two to four sentences: what to build, where it goes, why it is first.>

### 2. <next control by leverage>

### Deferred

<Findings no recommendation covers, with the reason. Usually one-off defects
with no shared root cause. Say so rather than inventing a control for them.>
```

1. **Every recommendation names the findings it closes.** One that closes no
   finding is a hardening opinion. It can appear, at the bottom, labelled so.
2. **Every finding is closed by a recommendation or listed under Deferred.**
   The reader must be able to account for all of them.
3. **Do not manufacture a control to look strategic.** Six unrelated defects
   means six unrelated fixes and no theme.
4. **Number one answers "what do I do first".** If the highest-leverage control
   is not the fix for the Critical, say which to do first and why. Usually it
   is the Critical, and leverage ordering resumes at two.
5. **No recommendation without a cost line.** Same rule as findings.

---

## Notes on severity

This doctrine generates no findings, so it generates no severities. Severity is
set by `rubrics/scoring.md` from impact and reachability, and is not modulated
by how good or bad the available remediation is.

Worth stating, because the pressure runs the other way. A defect with an
expensive structural fix is not thereby less severe, and one with a one-line
patch is not thereby more urgent than the matrix says. How hard it is to fix
belongs in the Remediation section; `rubrics/scoring.md` section 6 lists it
among the things that are not severity.

The one legitimate interaction: if you cannot describe a remediation at all,
that is a signal you may not understand the defect well enough to have verified
it. Go back to Rule 2 rather than shipping a finding with a vague fix.
