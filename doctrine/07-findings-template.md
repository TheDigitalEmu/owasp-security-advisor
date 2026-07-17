# 07. Findings Template

**Doctrine ID:** `07-findings-template`
**Mode:** review and build
**Source standards:** OWASP Code Review Guide, CWE, CVSS 3.1 (as vocabulary,
not as the scoring model; see `rubrics/scoring.md`)

---

## The shape of a finding

One finding per file, at
`<findings-root>/findings/<SEVERITY>-<NNN>-<slug>.md`.

`<SEVERITY>` is one of `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`, uppercase,
so the directory sorts usefully. `<NNN>` is a zero-padded sequence assigned in
discovery order and never reused.

**The finding's ID is `F-<NNN>`, and severity is not part of it.** The filename
carries the severity; the identity does not. This matters because severity is
*expected* to move during the verification pass: that is what the pass is for.
An ID with the severity baked into it would change every time the rubric
corrected you, which breaks every reference to it in the same moment the
correction proves the process is working.

So a finding discovered third is `F-003` forever. If it starts as a suspected
Critical and the verification ceiling holds it at Info, the file is renamed
from `CRITICAL-003-<slug>.md` to `INFO-003-<slug>.md` and the ID does not move.
Cross-references keep resolving, and the history of the severity change is
visible in the rename rather than lost in a renumber.

---

## Template

Copy this verbatim. Every field is required. A field you cannot fill is itself
information: write "unverified" and say what would settle it. Do not delete the
row.

```markdown
---
id: F-<NNN>
title: <one line, states the defect, not the category>
severity: Critical | High | Medium | Low | Info
verified: true | false
confidence: high | medium | low
owasp:
  - <e.g. A01:2021 Broken Access Control>
  - <e.g. API1:2023 Broken Object Level Authorization>
asvs:
  - <e.g. 4.1.3>
cwe:
  - <e.g. CWE-639>
component: <entry point or module, using placeholders if the report is public>
status: open | accepted-risk | fixed | wont-fix | duplicate
---

# <title>

## Summary

Two sentences. What is wrong, and what an attacker gets out of it. No
preamble, no restatement of the category, no "as you may know".

## Location

| | |
|---|---|
| Entry point | `<file>:<line>` |
| Sink | `<file>:<line>` |
| Control that should have stopped it | `<file>:<line>`, or "none found" |

## Trace

The verified path from untrusted input to the dangerous operation. Every hop
is a file and a line **you personally read**. This section is the evidence for
Rule 2, and a reviewer must be able to walk it without you.

1. `<file>:<line>` -- <what happens to the input here>
2. `<file>:<line>` -- <next hop>
3. `<file>:<line>` -- <the sink>

Controls read and ruled out on this path:

- `<file>:<line>` -- <control name>: <why it does not stop this>

## Failure scenario

Concrete. Named actor, specific input, specific outcome. If you cannot write
this paragraph without hedging, the finding is not verified and its severity
is Info.

> An unauthenticated caller sends <specific input> to <entry point>. Because
> <specific reason grounded in the trace>, the request reaches <sink>, and
> <specific consequence>.

## Impact

What is actually at stake: which data, whose data, how much, and whether it is
read, modified, or destroyed. Tie this to the threat model from step 2, not to
a generic severity narrative.

## Reachability

| | |
|---|---|
| Authentication required | none / any authenticated user / privileged role |
| Preconditions | <what must be true> |
| Reachable in the deployed configuration | yes / no / unverified, and how you know |

## Verification

State plainly what you did. Rule 2 lives or dies here.

- Files read end to end: `<list>`
- Middleware chain confirmed at: `<file>:<line>`
- Framework version confirmed at: `<file>:<line>`
- Framework default behaviour for this version: <what, and where you confirmed it>
- Refutation attempts made, and why each failed to kill the finding:
  - <attempt> -- <result>

If any of the above is missing, set `verified: false` and hold severity at
Info.

## Remediation

What to change, specifically enough to act on, framed against
`doctrine/05-proactive-controls.md`. Prefer the structural fix over the patch:
a control that makes the whole class impossible beats a fix at one call site.

State the trade-off honestly, including performance and compatibility cost. A
remediation with no cost named reads as though you did not look for one.

## References

- <OWASP page, ASVS section, CWE entry, cheat sheet>
```

---

## Rules for writing findings

1. **The title states the defect, not the category.** "Order lookup accepts any
   order ID from any authenticated user" is a title. "Broken Access Control" is
   a label; it goes in the `owasp` field.
2. **No finding above Info without a complete Trace and Verification section.**
   Rule 2 is enforced here, in the template, on purpose.
3. **The failure scenario must be concrete.** If you are writing "an attacker
   could potentially", you have a hypothesis, not a finding.
4. **Cite files and lines, never memory.** Rule 3.
5. **One defect per finding.** Three call sites of the same defect are one
   finding with three locations. Three different defects are three findings,
   even in one file.
6. **Do not pad.** A review with six real findings is worth more than one with
   forty, of which six are real. Padding is how the six get ignored.
7. **Say what you could not check.** Unverified findings go in
   `<findings-root>/unverified.md` with the same honesty and the reason.
8. **Rule 7 applies.** No em dashes or dash look-alikes in any finding.

## Duplicates and clusters

If many findings share a root cause, write one finding for the root cause at
its true severity, and reference the instances as locations within it. Then say
so in the report. A reader who sees twenty Highs that are one missing
middleware learns less than a reader who sees one High named accurately.

## Accepted risk

If the user says a finding is accepted risk, set `status: accepted-risk` and
record **who** accepted it and **when**. Do not delete it, do not downgrade its
severity, and do not soften the impact text. Severity describes the defect.
Acceptance describes a decision about the defect. They are different fields and
conflating them is how a risk register stops being true.
