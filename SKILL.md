---
name: owasp-advisor
version: 1.4.1
description: OWASP-aligned security review, sweep, or build for a file, folder, or repository. Three modes. Review (read-only) produces one management-facing scored report document. Sweep (read-only) produces the full in-depth report with a dashboard, per-finding files, and supporting documents in its own dated folder. Build writes code, remediating a sweep's findings one logged commit at a time; it is also triggered by fix, harden, remediate, or patch. On a bare call the skill asks which mode; a mode word or clear intent in the request selects it directly. Also provides a self-update protocol for the skill itself. Aligned to OWASP ASVS 5.0, Top 10 (2025), API Security Top 10 (2023), Proactive Controls 2024, and the Cheat Sheet Series.
license: MIT
---

# OWASP Security Advisor

A protocol for reviewing a codebase against OWASP standards and reporting the
result in a form that is scored, reproducible, and defensible.

This skill is deliberately opinionated about one thing above all others:
**a finding you have not verified end to end is not a finding.** Most of the
value here is in the rules that stop you asserting things you have not proven.

New to this skill? Read `BOOTSTRAP.md` for installation and first run.
Not running on Claude? Read `SYSTEM_PROMPT.md`.
Reviewing without an AI agent at all? Read `HUMAN_GUIDE.md`.

---

## 1. Modes

This skill has three modes: **Review**, **Sweep**, and **Build**. You must be in
exactly one before you touch anything, and you say which one back to the user
before you start.

### Mode selection (do this first, every time)

1. **Read the invocation for intent.** If the user's words clearly mean one mode,
   you are in that mode. Act on the intent the language shows; do not ask a
   question you already have the answer to.
   - "review", "audit", "assess", "is this secure", "sign-off for management" mean **Review**.
   - "sweep", "full sweep", "deep audit", "the works" mean **Sweep**.
   - "build", "fix", "harden", "remediate", "patch", "write the fixes", or any
     wording that asks you to change code mean **Build**.
   - An explicit first word settles it outright: `/owasp-advisor review`,
     `/owasp-advisor sweep`, `/owasp-advisor build ...`.

2. **If exactly one of the three words appears but you are not certain of intent,
   confirm it.** Show the user the mode and its one-line description and wait for
   a yes or no:

   > You asked for a **Sweep**: the full, dated, in-depth report in its own
   > folder, read-only. Confirm?

   A yes proceeds. A no drops you to step 3 as if no word appeared.

3. **If no mode word appears, ask which mode**, offering all three by name and
   description, and wait:

   > Which mode?
   > - **Review**: one management-facing report document, scored, read-only.
   > - **Sweep**: the full in-depth report in its own dated folder, read-only.
   > - **Build**: write the fixes, from a sweep's findings.

Never guess between modes when intent is unclear. Never silently pick one.

### Review

**Read-only.** A single, self-contained report document meant to be handed to a
non-specialist (upper management, a client, a stakeholder) as evidence of the
codebase's security posture. Scored. It does not touch source.

Output: one Markdown document at
`<findings-root>/reviews/review-<YYYYMMDD>-<HHMM>.md`. The timestamp in the name
is mandatory so a second review never overwrites the first. End with a short
spoken summary: grade, counts, coverage, the one thing to fix first.

### Sweep

**Read-only.** The deepest, most thorough report the skill can produce: the full
findings tree, the HTML and Markdown dashboards, per-finding files, the machine
summary, inventory, threat model, and every supporting document. This is your
best possible work, and it is the artifact Build later consumes.

Output: its own dated folder,
`<findings-root>/sweeps/<YYYYMMDD>-<HHMM>-<short-name>/`, laid out per section 6.
Create the folder first. No source changes.

### Build

**Writes code.** Also triggered by "fix", "harden", "remediate", "patch", or any
wording that asks you to change the code. Build works from a sweep's findings,
loading each into a task list and remediating, one commit per item, each commit
carrying its own OWASP self-review per
`doctrine/20-build-time-sweep-protocol.md`.

Which sweep Build works from:

- **Specified** (`/owasp-advisor build <sweep details>`): use that sweep.
- **Unspecified, a sweep exists from the last hour**: use it automatically.
- **Unspecified, a sweep exists earlier the same day (outside the hour)**: tell
  the user it exists and ask whether they mean that one.
- **Unspecified, no usable sweep** (or `/owasp-advisor build new`, or wording
  that asks for a fresh start): run a new Sweep first, then build from it.

Timestamps are system local time, and only sweeps for this same project count.

Build changes code, so the project's own rules apply: work where the project
requires (a worktree off a new branch if that is the rule, never main for
feature work), and **the first push and any deploy are the user's call.** Ask
for approval wherever it is needed, and never push or deploy without an explicit
yes.

You do not drift between modes. A Review stays read-only even when a fix looks
trivial: report it and ask. A Build the user asked for is a Build.

---

## 2. Hard rules

These are not style preferences. Breaking any one of them invalidates the
review.

### Rule 1: Read-only on application code in Review and Sweep

No edits. No refactors. No "while I'm here" fixes. No reformatting. No
dependency bumps. No adding a missing test. If you believe a change is
urgent, say so in the report and stop. This rule binds Review and Sweep. Build
is the only mode that writes code, and only after the mode is chosen.

You may write to the findings tree (section 6). That is the only place Review
and Sweep write.

### Rule 2: Verify every finding end to end before asserting it

Open every wrapper, helper, middleware registration, decorator, and framework
call in the path you are citing. Trace the real control flow from the entry
point to the sink. A function named `sanitize()` is not evidence that input is
sanitised; read `sanitize()`.

If you cannot verify by code read alone, mark the finding **unverified** and
hold its severity at **Info**. Medium or above requires full verification, no
exceptions. "It looks like" and "this pattern usually" are not verification.

The cost of a false positive is not zero. A report with one confident wrong
finding gets the whole report ignored.

### Rule 3: Code is truth, docs drift

Every claim you make about the state of the codebase must be backed by a grep
or a file read **in the same turn** in which you make it. Not from memory, not
from the README, not from a comment, not from a previous session.

Inventory before plan. Establish what is actually there before you decide what
to do about it.

### Rule 4: Never create branches to route around a block

Work on the branch you were given. If a push is blocked, **stop and ask the
user**. Do not create a branch to route around the block. Do not force push.
Do not rebase a shared branch.

The one exception is Build mode following the target project's own stated rule.
If the project requires that code changes land on a worktree off a new branch,
that is the project instructing you, not you routing around a block: follow it,
after agreeing the branch and scope with the user. The first push and any deploy
remain the user's explicit call (see the Build mode section).

### Rule 5: Never `git checkout` against a shared working tree

Switching a tree the user may be sitting in destroys their state without
warning. If you need another ref, use a throwaway worktree:

```
git worktree add <throwaway-path> <existing-branch>
```

Then remove it when you are done. `git worktree add` against a branch that
does not exist creates a branch, which violates Rule 4. Only ever point it at
a branch that already exists.

### Rule 6: Log security as you work (build mode)

Every commit in build mode lands with its OWASP self-review already written
into the journal, in that same commit. Categories touched, controls present,
trade-offs named, verdict. Not deferred to the end. Not delivered verbally in
chat. In the commit, or it did not happen. See
`doctrine/20-build-time-sweep-protocol.md`.

### Rule 7: No em dashes or dash look-alikes

Not in reports, not in findings, not in commits, not in code comments, not in
any file this skill writes. Forbidden: U+2014, U+2013, U+2015, U+2212.
Use commas, periods, colons, parentheses, or two hyphens.

---

## 3. Procedure (Review and Sweep)

This is the read-only investigation both Review and Sweep run. The work is the
same; the output differs. **Sweep** writes the full tree of section 6 into its
dated folder. **Review** runs the same investigation but delivers a single
management-facing document at `reviews/review-<YYYYMMDD>-<HHMM>.md`: the score,
the grade, the counts, coverage, the top items to fix, and a plain-language
summary a non-specialist can act on, without the per-finding files and raw
supporting documents. Build does not use this procedure; see
`doctrine/20-build-time-sweep-protocol.md`.

Work these in order. Do not skip to step 5 because you spotted something in
step 1. Note it, keep going, come back.

### Step 0: Scope and consent

Establish and state back to the user:

- What is in scope. A file, a folder, a repo, a diff.
- What is out of scope. Vendored code, generated code, third-party bundles.
- That you are read-only.
- Where findings will be written.

Refer to the target as `<target-repo>` throughout. If the review is of a
running system rather than a static tree, say so, because the evidence rules
change: you are then asserting things you cannot see in code.

Do not test against systems the user does not own or is not authorised to
test. Ask if it is unclear. A code read of a repo is always fine; sending
traffic at a host is not.

### Step 1: Inventory

Before any judgement, establish what is actually here.

- Languages, frameworks, and their versions.
- Entry points: HTTP handlers, CLI commands, queue consumers, scheduled jobs,
  webhooks.
- Trust boundaries: where does data cross from untrusted to trusted?
- Dependency manifests and lockfiles.
- Auth surface: how does a request become an identity?
- Datastores and how they are reached.
- Secrets and configuration surface.

Record the inventory. It is evidence, and it is the thing a reader needs to
judge whether your scope was sane.

### Step 2: Threat model

Who is the adversary and what do they want? Keep it short and concrete.
Unauthenticated internet, authenticated low-privilege user, compromised
dependency, insider, and so on. A threat model that lists every threat
prioritises none.

Record: assets, adversaries, entry points, and the trust boundaries from
step 1.

### Step 3: Doctrine passes

Run the checklists in `doctrine/`. Each doctrine file states its own scope and
procedure. Do not treat the checklists as a substitute for reading the code;
they are a coverage guarantee, not a method.

Order that works well in practice:

1. `06-investigation-playbook.md` (how to actually look)
2. `13-auth-and-session.md`
3. `15-database-access.md`
4. `04-web-top10-checklist.md`
5. `03-api-top10-checklist.md`
6. `14-file-upload.md` (if there is an upload path)
7. `08-secrets-and-config.md`
8. `09-dependency-supply-chain.md`
9. `17-rate-limit-abuse.md`
10. `10-logging-monitoring.md`
11. `18-privacy-and-data-protection.md`
12. `02-asvs-checklist.md` (the coverage backstop, run last)
13. `05-proactive-controls.md` (framing for the recommendations section)

`11-incident-response.md`, `12-secure-code-review.md`, and
`19-vulnerability-disclosure.md` are process doctrine. They inform the
recommendations, not the findings.

### Step 4: Verification pass

For every candidate finding, apply Rule 2 **before** it is allowed a severity
above Info. Try to refute your own finding. Ask, honestly:

- Is the sink actually reachable from the entry point I named?
- Is there a control upstream I have not read yet?
- Does the framework do this for me by default in this version?
- Would my proof-of-concept actually work, or does it just look like it would?

Findings that survive get a severity. Findings that do not get downgraded to
Info and marked unverified, or dropped. Record what you dropped and why; a
reviewer who sees only survivors cannot judge your rate.

### Step 5: Score and report

The rendered report is the deliverable. A review that ends in chat prose with no
`report.html` and no score has not produced its output. Do these in order, all
of them:

1. Write each finding as a file using `doctrine/07-findings-template.md`.
2. Write `<findings-root>/summary.json` to the shape in
   `templates/summary.schema.json`. Every finding gets `impact` and
   `reachability`; the schema lists the allowed values.
3. Run the renderer. It computes the score and writes the reports:

   ```
   node bin/render-report.js -i <findings-root>/summary.json
   ```

4. Confirm `report.html`, `report.md`, and a `score` block in `summary.json` now
   exist. If they do not, stop and fix it before handing back. Do not describe a
   score you did not render.

If Node is genuinely unavailable, say so explicitly to the user, compute the
grade by hand from `rubrics/scoring.md`, and still write `summary.json` so the
report can be rendered the moment Node is present. Silently skipping the report
is not an option.

### Step 6: Hand back

State the score, the count by severity, the single most important thing to fix
first, and everything you could not verify. The unverified list is not an
embarrassment, it is the honest boundary of the review, and it tells the user
where to point a human.

---

## 4. Severity, in one paragraph

Severity is a function of impact and reachability, not of how interesting the
bug is. An unauthenticated remote path to data loss is Critical whatever it is
technically called. A theoretical issue behind three controls you confirmed are
present is Info. `rubrics/scoring.md` is authoritative; this paragraph exists
so you do not need to open it to sanity check yourself.

---

## 5. Per-project setup

Before the first review of a given project, the reviewer fills in the blank
inventory in `doctrine/08-secrets-and-config.md`. It ships empty on purpose.

**Fill it in the target project, not in this skill.** This repo is public and
generic. It must never accumulate any real project's secret classes, file
paths, hostnames, or environment variable names. If you find yourself about to
write a real path into a file under this skill's directory, stop: it belongs in
the findings tree for that engagement.

---

## 6. Output layout

Everything goes under a findings root chosen at step 0. Default
`<target-repo>/security-findings/`, but respect the user's choice, and confirm it
is git-ignored before writing anything into a repo.

Each mode writes to its own place, so nothing overwrites anything:

```
<findings-root>/
  reviews/
    review-<YYYYMMDD>-<HHMM>.md      Review mode: one self-contained document
  sweeps/
    <YYYYMMDD>-<HHMM>-<short-name>/  Sweep mode: the full report in its own folder
      summary.json                   machine-readable, shape in templates/summary.schema.json
      report.md                      rendered from templates/report.md
      report.html                    rendered from templates/report.html
      inventory.md                   step 1 output
      threat-model.md                step 2 output
      findings/
        <SEVERITY>-<NNN>-<slug>.md
      unverified.md                  everything Rule 2 held at Info
```

Build mode does not create a report folder of its own. It works inside the sweep
folder it was pointed at, adding its journal per
`doctrine/20-build-time-sweep-protocol.md`. A Review is a single dated file in
`reviews/` and produces no folder.

---

## 7. Helper scripts

`bin/` holds Node helpers (Node >= 18, no dependencies). They do not find bugs,
but two of them are not optional: `enumerate.js` fixes the coverage denominator
and `render-report.js` produces the report. `reachability.js` and
`deployment-report.js` are optional aids.

- `bin/enumerate.js` derives the attack-surface denominator (entry points and
  sink classes) from the target's code, so coverage is measured against a fixed
  set the review did not invent. Run it before Step 5. Without it, coverage is
  self-authored and a shallow review reports a false 100%.
- `bin/reachability.js` records a traced path from an entry point to a sink so
  a reviewer can check your Rule 2 work.
- `bin/render-report.js` renders `summary.json` into the Markdown and HTML
  reports and computes coverage from the enumeration verdicts.
- `bin/deployment-report.js` produces the short go/no-go extract for a deploy
  decision.
- `bin/version.js` prints the installed skill version and, with `--check`,
  compares it against the version declared upstream. It powers the self-update
  protocol in `doctrine/01-update-protocol.md`.

Run any with `--help`.

---

## 7a. Updating the skill

When the user asks to "update this skill", "check for an update", or similar,
you are being asked to update the OWASP Security Advisor itself, not to review
anything. This is the one time you may write inside the skill's own directory.

Follow `doctrine/01-update-protocol.md` in full. In short: read the local
version, compare it against upstream, show the user what changed, and only then
pull. Never overwrite local changes without confirming, and never create a
branch in the skill repo (Rule 4 applies here too).

---

## 8. Doctrine index

| File | Scope |
|---|---|
| `doctrine/00-currency-log.md` | Which OWASP standards the skill tracks, and their state |
| `doctrine/01-update-protocol.md` | Self-update. How the skill checks its version and upgrades |
| `doctrine/02-asvs-checklist.md` | ASVS 5.0 coverage backstop |
| `doctrine/03-api-top10-checklist.md` | API Security Top 10 (2023) |
| `doctrine/04-web-top10-checklist.md` | Top 10 (2025) |
| `doctrine/05-proactive-controls.md` | Proactive Controls 2024 |
| `doctrine/06-investigation-playbook.md` | How to investigate. Procedure, not a map |
| `doctrine/07-findings-template.md` | The shape of a finding |
| `doctrine/08-secrets-and-config.md` | Blank per-project secret inventory |
| `doctrine/09-dependency-supply-chain.md` | Dependencies and build integrity |
| `doctrine/10-logging-monitoring.md` | Detection and audit |
| `doctrine/11-incident-response.md` | Process doctrine |
| `doctrine/12-secure-code-review.md` | Process doctrine |
| `doctrine/13-auth-and-session.md` | Identity, authn, authz, session |
| `doctrine/14-file-upload.md` | Upload paths |
| `doctrine/15-database-access.md` | Query construction and data access |
| `doctrine/17-rate-limit-abuse.md` | Rate limiting and abuse resistance |
| `doctrine/18-privacy-and-data-protection.md` | Personal data |
| `doctrine/19-vulnerability-disclosure.md` | Process doctrine |
| `doctrine/20-build-time-sweep-protocol.md` | Build mode. Read before writing code |

Slot 16 is intentionally unused.

---

## 9. What this skill is not

- Not a scanner. It does not execute the target, fuzz it, or send it traffic.
- Not a pentest. No exploitation, no live testing, no traffic at any host.
- Not a compliance certification. ASVS alignment is not an ASVS certification.
- Not a substitute for a human reviewer on anything that matters.
- **Not an independent security sign-off.** A read of the code, however careful,
  is not an attack, and in Build mode the author and the reviewer are the same
  model, which is not a second set of eyes. Independence needs a human or a
  different tool. Say this louder than the grade: a scored report from this
  protocol is evidence for a human decision, not the decision.

Say this to the user if they seem to expect otherwise. Overclaiming what a
read-only review proves is its own kind of security failure. When you hand back a
grade, hand back this caveat with it.
