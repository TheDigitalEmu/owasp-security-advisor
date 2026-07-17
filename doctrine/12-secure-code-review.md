# 12. Secure Code Review

**Doctrine ID:** `12-secure-code-review`
**Mode:** review and build
**Source standards:** OWASP Code Review Guide, OWASP SAMM (Design and
Verification business functions), ASVS 5.0 chapter 1 (architecture, design and
threat modelling)

---

## Purpose

This file assesses **the organisation's ongoing code review practice as a
control**. Does `<target-repo>`'s team catch security defects before they
merge, and would the practice keep working after the person who cares about it
leaves?

**This is not the procedure for the review you are currently running.** That is
`doctrine/06-investigation-playbook.md`. The titles collide and readers land
here by mistake, so: if you want to know how to trace an entry point to a sink,
close this file and open 06. If you are assessing whether a team's pull request
process is worth anything, you are in the right place.

Output lands in the recommendations section, not the findings tree, unless the
practice failure is demonstrable from the repository. It often is.

## Principles

1. **Review is a sampling control, not a coverage control.** It reduces the
   rate at which defects merge. It does not establish that none did.
2. **Reviewers do not find missing things.** The structural limit; everything
   else follows.
3. **An ignored tool is worse than no tool.** A scanner nobody triages produces
   a green pipeline, a large ignore file, and a documented belief that the code
   was checked. No tool at least leaves the team honest.
4. **Any gate that becomes a bottleneck gets routed around.** Not maliciously.
   By deadline. Design for the week everyone is behind, because that is the
   week the bad change ships.
5. **A metric that can be met without the underlying work will be.** Choose
   metrics whose cheapest path to a good number is doing the work.

---

## Review as a control: what it catches and what it cannot

Review catches defects **present in the diff**: a concatenated query, a
hardcoded credential, a disabled certificate check, an obviously wrong
comparison. For these it is genuinely good and cheap.

It structurally cannot catch:

- **Missing controls.** No authorization check appears in the diff because none
  was written. The reviewer sees a clean, readable handler and approves it.
  Nothing on screen is wrong. The vulnerability is the absence, and absence has
  no line number.
- **Emergent defects.** The change is correct, and correct in combination with
  the other change that merged the same afternoon too, unless you read both,
  which nobody did.
- **Anything needing the wider map.** Whether this endpoint is behind the
  gateway, whether that middleware is registered, whether a framework default
  changed in the version bump three PRs ago.
- **Architectural drift.** Each change is a reasonable local step. Twenty
  reasonable local steps arrive somewhere nobody would have chosen.

This is the same failure the reviewer of *this* engagement must resist, and why
`doctrine/06-investigation-playbook.md` gives it a whole phase: Phase 5, look
for the absence. The diff is where the change is. The vulnerability is
frequently somewhere else. When assessing a team's practice, ask whether
anything in it ever looks outside the diff. Usually the answer is no, and
usually nobody has noticed that is a gap.

The honest framing for the team: review is one layer, and not the layer that
catches missing authorization. That layer is a centralised deny-by-default
control, per `doctrine/05-proactive-controls.md`.

---

## Risk-based triage: which changes get security attention

Reviewing every change with equal security attention means reviewing none with
real security attention. Assess whether the team has a rule for which get more.

| Change touches | Why |
|---|---|
| Authentication or session handling | Whole-system impact, subtly wrong easily, hard to test |
| Authorization decisions | The absence problem lives here |
| Cryptography or key handling | Silent failure; no test catches a weak-but-working construction |
| Data access layer or query construction | One helper becomes every injection |
| File upload, parsing, deserialisation | Untrusted bytes reaching a parser |
| Dependency manifests or lockfiles | The change is one line and the impact is unbounded |
| Infrastructure as code, CI configuration | Grants and network position, reviewed by people reading it as YAML |
| Anything crossing a trust boundary | By definition |
| Anything that turns a control off | Including "temporarily" |

The tell of a mature practice: the trigger is mechanical, not cultural. Path
patterns in code owners, a label applied by tooling, a required reviewer on
specific directories. If the trigger is "the author remembers to flag it", it
does not exist, because the author who does not know it is a security change is
exactly the author who needed the trigger.

---

## What to ask for in a review

The code is not enough. Ask for the **threat model delta**. Not a document: two
or three sentences answering what changes about the attack surface.

- Does this add an entry point, or make an existing one reachable by a caller
  who could not reach it before?
- Does data cross a trust boundary it did not cross before?
- Any new dependency, outbound call, or place the application fetches
  something?
- Does it change who can do what? New role, grant, scope, token?
- If this is wrong in the worst plausible way, what is the blast radius?

A team that cannot answer these has not thought about the change, and the
review is theatre regardless of how many comments it collects. A team that
answers them in the description gives every future reviewer, including this
engagement, a record of intent to check the code against.

This is ASVS chapter 1 and SAMM's Design function: does threat modelling happen
at change time, or only at review time, which is too late to be cheap?

---

## Automation and its honest limits

**Static analysis.** Useful and oversold. The false-positive rate on security
rules in a real codebase is high enough that a team's first encounter with a
full ruleset is usually its last. What follows is one of three states: the tool
is removed, it is set to warn and nobody reads warnings, or the suppression
file grows until it encodes the entire finding set as accepted. All three are
worse than not running it, because all three produce a pipeline that looks
checked.

Assess: is the ruleset curated to rules the team acts on? Is the signal ever
triaged by a person? When the team suppresses a rule, is the reason recorded? A
suppression with a reason is engineering. A suppression file with 400 entries
and no reasons is a confession.

**Secret scanning.** The one automated control with a genuinely good return.
Low false-positive rate when tuned, unambiguous when it fires, and the defect
is severe and common. If a team runs exactly one automated security control,
this is it. Assess: does it run against history as well as the diff, and does a
hit trigger **rotation** rather than a force push? A team that deletes the
commit and considers it handled does not understand what happened.
`rubrics/scoring.md` worked example E is the same point.

**Dependency scanning.** Governed by
`doctrine/09-dependency-supply-chain.md`. The question here is not "do they
scan" but "what happens when it fires". A queue of 200 advisories nobody can
act on is the ignored-tool failure again.

**Pre-commit versus CI.** Teams get this backwards.

| | Pre-commit | CI |
|---|---|---|
| Feedback speed | Immediate | Minutes |
| Bypassable | Yes, trivially, and everyone learns the flag | No, if branch protection is real |
| Runs on | The author's machine and config | A known environment |
| Good for | Formatting, fast lint, obvious secret patterns | Anything that must be true of merged code |

Anything security-relevant belongs in CI, because pre-commit is advisory by
construction. A team that enforces its security gates only in pre-commit has
enforced nothing, and the bypass flag is in someone's shell alias already.

---

## The security champion model

One person per team with more security context than the rest, who reviews risky
changes and escalates what is beyond them.

It beats a central security team gating every change, for one reason: a
specialist gate becomes a bottleneck, and a bottleneck under deadline becomes a
thing people learn to route around. The routing is always creative and always
invisible. The change gets split so no single PR trips the trigger. The work
lands behind a flag and the flag gets flipped later. The reviewer gets asked
for a quick approval on a Friday and gives one.

The champion model fails differently. Assess for its failure modes rather than
assuming it works:

- **The champion is one person.** They leave or take holiday, and the control
  is gone with no alarm.
- **No time budget.** Security review sits on top of delivery commitments, so
  it is what gets dropped in the week it matters most.
- **No authority.** They can comment, not block. A reviewer who cannot block is
  a suggestion.
- **They become the gate anyway.** A bottleneck with a friendlier name.

The question is not "do you have a champion" but "what happens to a risky
change when the champion is unavailable". If the answer is "it merges", the
control is availability-dependent and is not a control.

---

## Reviewing AI-generated code

Current, unsolved, and it breaks the reviewer in a specific way.

Generated code is **fluent**: consistent naming, plausible structure,
sensible-looking error handling, comments that read like someone understood the
problem. Every heuristic a reviewer has for "this was written by someone
competent, I can read it faster" fires, and every one is now uncorrelated with
whether the code is correct. The reviewer's prior calibration is broken, and
broken toward leniency: the code looks *better* than the average human diff, so
it gets less scrutiny, not more.

- **Helpers that do less than their name claims.** Generated code invents
  plausible names. A `validateAndSanitizeInput()` that trims whitespace and
  returns. A `checkPermission()` that checks whether the user is logged in.
  This is exactly the Rule 2 failure mode and the reason Rule 2 exists: the
  name is not evidence, read the function. Generated code makes the trap far
  more common, because a human writing a weak helper usually names it weakly.
- **Confidently wrong idiom.** Real, well-formed, and belonging to a different
  framework, a different version, or a context where it was safe and here is
  not.
- **Invented API surface.** A config option, flag, or method that does not
  exist. This mostly fails loudly. Mostly.
- **Controls that are cargo.** A header set to a value that parses and enforces
  nothing. A regular expression that anchors nothing. A comparison that is not
  constant-time despite a comment saying it is.
- **Volume.** Generated code arrives faster than review capacity. The practice
  that worked at 200 lines a day does not work at 2000.

Ask the team: does anything in your process distinguish generated code from
written code? Is the author accountable for understanding what they submitted?
Can they explain the helper they did not write? "I reviewed it" from an author
who generated it is a claim about reading, not understanding, and the two have
never been further apart.

---

## Reviewer independence

The author cannot be the only reviewer. Not a process nicety: the entire
premise. An author reviewing their own work checks the code against the model
in their head, and the defect is in the model.

Assess for the ways independence quietly disappears:

- Self-approval permitted, in configuration or by convention.
- Reciprocal approval: two people who approve each other's work unread. Shows
  up in metrics as excellent review coverage.
- The urgent-fix exemption, used for everything urgent, and everything is
  urgent.
- The reviewer who was in the design meeting and shares the author's model:
  most of the value of review gone while the box is still ticked.

**Build mode of this skill has exactly this problem.** The agent writes the code
and then reviews it, which is this failure in its purest form. The compensating
control is `doctrine/20-build-time-sweep-protocol.md`: structured, adversarial,
written into the commit rather than delivered in chat, and mandatory rather
than at the agent's discretion. It is a compensating control, not a solution.
Say so to the user rather than presenting build mode output as though it were
independently reviewed. It was not.

---

## Metrics that mislead

All real, all commonly reported, all gamed by default rather than by intent. If
the organisation reports these, the numbers are wrong, and the error always
runs favourable.

| Metric | How it lies |
|---|---|
| Review coverage percentage | Counts approvals, not reading. Reciprocal rubber-stamping scores 100 percent |
| Time to approve | Rewards speed. The fast path to a good number is approving without reading. Improving it destroys the control |
| Comment count | Rewards volume. Produces style nitpicks, because those are cheap and countable and security comments are neither |
| Security findings raised in review | Falls when the practice improves and when it collapses. Indistinguishable without other evidence |
| Defects caught in review | Denominator unknown. You cannot count what merged unnoticed, which is the number you wanted |
| Tool pass rate | Goes to 100 percent via the suppression file |

Worth measuring instead, though all of it is harder: escaped defects traced
back to the review that missed them, time from advisory to shipped dependency
update, and the proportion of risky changes that got the risk-based treatment.

---

## Review procedure

Assessing the practice, not the code. Rule 3 throughout: every claim is backed
by something you read, or something the team told you and you labelled as told.

1. **Read the branch protection and code owners configuration.** Not the policy
   document, the configuration. Required reviewers, required checks, who can
   dismiss a review, whether administrators are exempt. The exemption list is
   the practice.
2. **Read the CI configuration.** Which security checks run, on what trigger,
   blocking or advisory. An advisory check does not exist. Confirm by finding a
   merged commit where it was red.
3. **Read any pre-commit or hook configuration.** Note which security controls
   are here and only here. Those are bypassable.
4. **Read the suppression and ignore files.** Size, age, and whether entries
   carry reasons. The single most informative artefact about a team's real
   relationship with its tooling.
5. **Sample the merge history.** Pick risky changes by the triage table and read
   the review they got. Approvals with no comments on a change that moved an
   authorization boundary tell you what the practice is worth.
6. **Look for self-approval and reciprocal approval** in that sample.
7. **Look for the threat model delta.** Does any description in the risky
   sample say what changed about the attack surface? Any at all?
8. **Establish whether generated code is present** and whether the process
   treats it differently. Commit sizes, velocity changes, and tooling
   configuration are the available signals. Do not assert authorship you cannot
   prove: if you cannot, say so and hold at Info per Rule 2.
9. **Ask what happens when the reviewer is unavailable**, and get a real answer
   rather than the policy answer.

Do not lecture the team in the report. State what the configuration does, state
what the sample showed, and let the gap speak.

---

## Checklist

| # | Control | ASVS ref | Evidence | Verdict |
|---|---|---|---|---|
| 12.1 | Merges to protected branches require a review from someone other than the author, enforced in configuration | 1.1.1 | | |
| 12.2 | Self-approval is not permitted, including for administrators and break-glass paths | 1.1.1 | | |
| 12.3 | A mechanical trigger routes security-relevant changes to additional review, by path or label rather than author memory | 1.1.2 | | |
| 12.4 | Security-relevant automated checks are blocking in CI, not advisory, and not enforced only in pre-commit | 1.1.2 | | |
| 12.5 | Secret scanning runs against diff and history, and a hit triggers credential rotation rather than history rewriting | 1.1.2 | | |
| 12.6 | Static analysis findings are triaged by a person; suppressions carry a recorded reason and an owner | 1.1.2 | | |
| 12.7 | Dependency advisories reach a named owner and have a defined path to a shipped update | 1.1.2 | | |
| 12.8 | Descriptions of security-relevant changes state the attack surface delta, not only the code intent | 1.1.3 | | |
| 12.9 | Threat modelling occurs at design time for changes crossing a trust boundary, with a recorded output | 1.1.2 | | |
| 12.10 | Security review capability does not depend on a single individual's availability | 1.1.1 | | |
| 12.11 | The reviewer of a security-relevant change is not the sole author of the design it implements | 1.1.3 | | |
| 12.12 | Expedited merge paths are defined, logged, and reviewed after the fact rather than used as the default | 1.1.1 | | |
| 12.13 | The process distinguishes generated from authored code, and the submitting author is accountable for understanding it | 1.1.3 | | |
| 12.14 | Review practice explicitly addresses missing controls, not only defects visible in the diff | 1.1.2 | | |
| 12.15 | Review metrics in use are not limited to coverage percentage, time to approve, or comment counts | 1.1.1 | | |

---

## Common false positives

| Looks like a finding | Why it may not be | How to tell |
|---|---|---|
| No documented review process | A small team with genuine per-change reading and a real blocking CI gate beats a large one with a process nobody follows | Read the merge history, not the documentation. Rule 3 |
| Direct pushes to the main branch in history | May predate the protection rule, or come from automation with its own controls | Check dates against when protection was configured, and check who pushed |
| A large scanner suppression file | If entries carry reasons and owners, this is a team that triaged a noisy ruleset, which is correct | Read a sample. Reasons present is the tell |
| Fast approvals | A one-line change to a static asset does not need forty minutes | Sample against the risk triage table. Fast approvals on risky changes are the finding |
| No security champion named | The role may be filled without the title | Ask who reads the auth changes, and see whether the history agrees |
| Pre-commit hooks present | Not a defect alone. The defect is a security control that exists *only* there | Check whether the same control is enforced in CI |
| No threat model documents | Threat modelling can be real and lightweight, living in change descriptions | Look in the descriptions of risky changes first |

---

## Notes on severity

Process findings here mostly have no path from an entry point to a sink, so the
reachability axis in `rubrics/scoring.md` does not apply cleanly and the honest
result is usually Low or Info. Resist inflation. "The team does not require a
second reviewer" is not a Critical, however much you would like it to be,
because it is not itself an exploitable defect.

The real exception: when a process failure is the **root cause of verified
findings you already filed**, write it as a single finding at a severity
derived from what it produced, and reference the instances as locations, per
the duplicates and clusters section of `doctrine/07-findings-template.md`. One
finding saying "authorization is reviewed by the author of the design and six
endpoints are missing checks" carries more than six unlinked Highs.

Where the process failure has no demonstrated consequence in the tree, it goes
in the recommendations section under `doctrine/05-proactive-controls.md`,
ordered by leverage. That is where it does the most good anyway. A report that
files fifteen Info-level process findings has diluted itself, and the reader
will skim past the one that mattered.
