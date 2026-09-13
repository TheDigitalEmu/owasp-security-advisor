# Scoring Rubric

**Authoritative.** Where this file and prose elsewhere disagree, this file
wins. `bin/render-report.js` implements it exactly; if the script and this file
ever diverge, the script is the bug.

The point of a rubric is that two reviewers, or the same reviewer twice, reach
the same number. Severity is not a feeling about how interesting the bug is.

---

## 1. Severity is impact multiplied by reachability

Score each axis independently, then read the severity off the matrix. Do not
pick a severity first and reason backwards to the axes.

Every axis value above the floor must be earned with a citation, not asserted.
The reviewer records that citation in the Axis justification block of
`doctrine/07-findings-template.md`. A level whose admitting fact you cannot cite
is not your level: drop to the one you can cite. This citation rule is what makes
two runs of the same review agree, and its absence is why they do not: a value
picked by judgment drifts, a value pinned to a file:line does not.

### Impact

The floor is Minor. Minor needs no positive evidence. **Moderate and above
require a citation naming the specific data or effect at stake.** "Non-public
data" you did not identify is Minor until you name it.

| Level | Value | Means | To claim it |
|---|---|---|---|
| Catastrophic | 4 | Full compromise, arbitrary code execution, mass data loss or exfiltration, authentication bypass for any account | Cite the sink and the scope of what it exposes |
| Severe | 3 | Access to or modification of data belonging to other users, privilege escalation, persistent compromise of one account | Cite the cross-user data or the escalation path |
| Moderate | 2 | Disclosure of non-public data of limited scope, integrity loss the user can detect and undo, denial of service against one tenant | Name the specific data class and cite where it is read |
| Minor | 1 | Information disclosure with no direct use, defence-in-depth gap, hardening opportunity | Floor. No positive citation required |

### Reachability

The floor is Theoretical. **Constrained and above require a positive citation of
a confirmed fact.** A precondition you assume, a config you did not read, a role
you did not find assigned: none admit the level. Absent the citation, the value
is Theoretical.

| Level | Value | Means | To claim it |
|---|---|---|---|
| Open | 4 | Unauthenticated, remote, no preconditions | Cite the entry point and the read of every middleware on the path confirming none require identity |
| Authenticated | 3 | Any authenticated user, no special role, no unusual preconditions | Cite the auth check, and confirm no further precondition |
| Constrained | 2 | Requires a privileged role, a race, a specific configuration, or a non-default state **you confirmed exists, with a citation** | Cite the role assigned, the config value set, or the state observed |
| Theoretical | 1 | Requires local access, an already-compromised component, or a precondition you could not confirm | Floor. This is where an unconfirmed precondition lands |

### Matrix

| | Open (4) | Authenticated (3) | Constrained (2) | Theoretical (1) |
|---|---|---|---|---|
| **Catastrophic (4)** | Critical | Critical | High | Medium |
| **Severe (3)** | Critical | High | Medium | Low |
| **Moderate (2)** | High | Medium | Low | Low |
| **Minor (1)** | Medium | Low | Low | Info |

---

## 2. The verification ceiling

**This overrides the matrix, always.**

| Verification state | Maximum severity |
|---|---|
| `verified: false` | **Info** |
| `confidence: low` | **Low** |
| `confidence: medium` | **Medium** |
| `verified: true` and `confidence: high` | matrix result |

A finding cannot be Medium or above unless you have completed the Verification
section of `doctrine/07-findings-template.md` in full: every hop read, every
middleware order confirmed, every framework default checked against the actual
version, every refutation attempted and defeated.

This ceiling costs you findings. That is the intent. A report whose Highs are
all real is worth more than a report with twice as many Highs, of which some
are not.

Downgrading under this rule is not a demotion of the finding, it is an
accurate statement about the evidence. Say so in the finding, and say what
would lift the ceiling.

---

## 3. Posture score

A single number, 0 to 100, computed only from **verified** findings.

```
score = 100 - (40 * critical) - (20 * high) - (8 * medium) - (3 * low)
score = max(0, score)
```

`Info` findings do not subtract. Unverified findings do not subtract. They are
reported separately and they are not silently priced into the number.

### Which findings count

| `status` | Counts toward the score? | Why |
|---|---|---|
| `open` | Yes | It is a live defect |
| `accepted-risk` | **Yes** | Acceptance is a decision about the defect. The defect is still there, and the score describes the application, not the risk register |
| `wont-fix` | **Yes** | Same argument. A defect nobody intends to fix is still a defect |
| `fixed` | No | Verified fixed within this engagement. Say so in the report |
| `duplicate` | No | It is counted once, under the finding it duplicates |

`accepted-risk` counting toward the score is deliberate and it will be
unpopular. A score that improves because somebody signed a form is a score that
measures paperwork. If the user wants the accepted items excluded, that is a
second number, reported next to the first and labelled as what it is, never
instead of it.

### Grade bands

| Score | Grade | Reading |
|---|---|---|
| 90 to 100 | A | No verified issue above Low. Ship. |
| 75 to 89 | B | Verified Mediums present. Ship with them tracked and dated. |
| 50 to 74 | C | Material verified issues. Fix before exposing to untrusted users. |
| 25 to 49 | D | Serious verified issues. Do not expose to untrusted users. |
| 0 to 24 | F | Critical verified issues. Do not deploy. |

### The override

**Any single verified Critical caps the grade at F, and any single verified
High caps it at C**, whatever the arithmetic says. One Critical is not
offset by everything else being clean, and a score that says otherwise is a
score that gets used to argue for shipping.

---

## 4. Coverage, reported alongside the score, never folded into it

The score says how bad what you found is. It says nothing about how much you
looked at. Report both, adjacent, always.

**Coverage is measured against a denominator you did not invent this run.** Run
`bin/enumerate.js` first: it derives the entry points from the code and adds the
fixed ten sink classes, producing a list identical on every run of the same
commit. You record a verdict (clear, finding, gap) on every element, and
`bin/render-report.js` computes coverage from those verdicts. An element with no
verdict is a gap. This is deliberate: without it, coverage is self-referential,
the reviewer supplies both the numerator and the denominator in the same pass,
traces everything noticed, and reports 100% no matter how little was examined.
That failure is exactly how one run found two issues and another found six, both
claiming full coverage. A derived denominator makes a shallow run show a low
coverage figure instead of a false clean bill.

The figures reported:

| Metric | Definition |
|---|---|
| Entry points enumerated | Count from Phase 2 of `doctrine/06-investigation-playbook.md` |
| Entry points traced | How many got a full Phase 4 trace |
| Coverage | traced / enumerated, as a percentage |
| Doctrine passes completed | Of the applicable set |
| Unverified findings | Count held at Info by the ceiling |
| Areas not reviewed | Named, in `unverified.md` |

**A score of 95 at 20 percent coverage is not an A.** It is an unfinished
review. Say that in the report, in those words if need be. A reader who takes
the number without the coverage will draw a conclusion the evidence does not
support, and the report will have caused the harm it existed to prevent.

---

## 5. Worked examples

**A.** Client-supplied record identifier used directly in a lookup with no
ownership check. Trace complete, middleware chain read, no authorisation found
anywhere on the path. Any logged-in user reads any other user's record.
Impact Severe (3), Reachability Authenticated (3), verified, high confidence.
Matrix: **High**. No ceiling applies.

**B.** Same defect, but the endpoint sits behind a role check you read and
confirmed, and only a small set of staff hold that role. Impact Severe (3),
Reachability Constrained (2). Matrix: **Medium**.

**C.** String concatenation into a query, in a helper you found by grep. You
have not traced whether any entry point reaches it, and you did not read the
callers. Impact would be Catastrophic (4), Reachability unknown, so
`verified: false`. Ceiling: **Info**. Write down that tracing the callers would
settle it. Do not file it as a Critical because the pattern looks bad. Not yet.

**D.** Missing security header on an HTML response. Impact Minor (1),
Reachability Open (4). Matrix: **Medium**. This is correct and it is why the
matrix is not the last word: check whether it genuinely gates an attack in this
application before you let it sit above the real findings in the report. If it
does not, Impact is Minor and you should be asking whether Reachability Open is
doing honest work here. A header that mitigates an attack the app is not
susceptible to is a hardening item; consider whether the finding belongs at
Low.

**E.** Live credential for the primary datastore, present in git history, repo
is private. Impact Catastrophic (4), Reachability Open (4): private repos get
cloned to laptops and forked, and the credential is valid now. Matrix:
**Critical**. Grade caps at F. Remediation is rotation, not deletion of the
commit.

---

## 5a. Reproducibility, and its honest limit

The same repository at the same commit should score the same on two runs. The
math already guarantees this: `bin/render-report.js` is a pure function of the
axis values and the finding set. So run-to-run variance can enter in only two
places, and this section says what pins each and what does not.

**Axis variance.** Two runs that both found a finding must give it the same
impact and reachability. The citation rule above is the pin: a value is admitted
only by a cited fact, so two honest reviewers either cite the same fact and agree,
or cite different facts and can be shown exactly where they diverged. This
removes the drift that comes from picking a level by feel. It does not remove
the judgment of whether a cited line actually says what the reviewer claims: that
residue is real and it is the base rate of misreading code. It is bounded,
because the citation is checkable by anyone.

**Enumeration variance.** Two runs may discover different findings. A finding
never written has no axis to pin. This is the larger residue, and the defence is
coverage: every enumerated entry point and sink gets a recorded verdict (see
`doctrine/06-investigation-playbook.md`), so a missed area shows up as a gap that
debits coverage rather than as a silently smaller, better-looking score. A run
that looked at less says so in the coverage figure next to the grade.

**What this does not claim.** It does not claim bit-for-bit determinism. It
claims that axis drift is pinned to citations, that missed coverage is visible
rather than silent, and that any two diverging runs can be reconciled by
comparing their cited facts. A grade handed over without its coverage figure, or
a finding rated above the floor without its Axis justification block filled, is
not a reproducible result and must not be presented as one.

---

## 6. Things that are not severity

Do not modulate severity for any of these. Each has its own field or section.

| Not severity | Where it goes |
|---|---|
| How hard it is to fix | Remediation section |
| Whether the user has accepted the risk | `status: accepted-risk` |
| Whether it is in scope | Scope statement, step 0 |
| Whether it is a duplicate of another finding | `status: duplicate` |
| How likely you think an attacker is to bother | Nowhere. You do not know |
| Whether the code is new or legacy | Nowhere |
| Whether the author is in the room | Nowhere |

The last three are the ones that quietly happen. Watch for them.
