---
name: owasp-advisor
version: 1.1.0
description: OWASP-aligned security review of a file, folder, or repository. Use when the user asks for a security review, security sweep, security audit, OWASP review, vulnerability scan, threat model, secure code review, or asks how secure their code is, or whether something is ready to deploy from a security perspective. Also provides a build mode for security-logged remediation work, and a self-update protocol for the skill itself. Produces a deterministic scored report with a dashboard (HTML and Markdown), per-finding files, and a machine-readable summary. Read-only on application code in review mode; never edits source. Aligned to OWASP ASVS 5.0, Top 10 (2025), API Security Top 10 (2023), Proactive Controls 2024, and the Cheat Sheet Series.
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

This skill has two modes. Decide which one you are in **before** you touch
anything, and say so out loud to the user.

### Review mode (default)

Read-only. You are an auditor. You produce a scored report and nothing else.
If the user asked "is this secure", "review this", "audit this", "can I ship
this", you are in review mode. If you are not sure which mode you are in, you
are in review mode.

Output: a findings tree (section 6) and a scored report. No source changes.

### Build mode (explicit opt-in only)

You write code. The user must have explicitly asked you to fix, remediate,
harden, or sweep. Every commit carries its own OWASP self-review in the
journal, in the same commit.

Build mode is governed by `doctrine/20-build-time-sweep-protocol.md`. Read it
in full before the first commit. Do not improvise the sweep structure.

You do not drift from review mode into build mode because a fix looked easy.
Finding something broken is not authorisation to fix it. Report it, and ask.

---

## 2. Hard rules

These are not style preferences. Breaking any one of them invalidates the
review.

### Rule 1: Read-only on application code in review mode

No edits. No refactors. No "while I'm here" fixes. No reformatting. No
dependency bumps. No adding a missing test. If you believe a change is
urgent, say so in the report and stop.

You may write to the findings tree (section 6). That is the only place review
mode writes.

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

### Rule 4: Never create branches

Work on the branch you were given. If a push is blocked, **stop and ask the
user**. Do not create a branch to route around the block. Do not force push.
Do not rebase a shared branch.

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

## 3. Procedure (review mode)

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

Apply `rubrics/scoring.md`. Write findings using
`doctrine/07-findings-template.md`. Render with `templates/`.

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

Everything the review writes goes under a findings root chosen at step 0.
Default `<target-repo>/security-findings/`, but respect the user's choice, and
confirm it is git-ignored before writing anything into a repo.

```
<findings-root>/
  summary.json              machine-readable, shape in templates/summary.schema.json
  report.md                 rendered from templates/report.md
  report.html              rendered from templates/report.html
  inventory.md              step 1 output
  threat-model.md           step 2 output
  findings/
    <SEVERITY>-<NNN>-<slug>.md
  unverified.md             everything Rule 2 held at Info
```

Build mode adds `sweeps/`. See `doctrine/20-build-time-sweep-protocol.md`.

---

## 7. Helper scripts

`bin/` holds optional Node helpers (Node >= 18, no dependencies). The review is
valid without them; they save typing, they do not find bugs.

- `bin/reachability.js` records a traced path from an entry point to a sink so
  a reviewer can check your Rule 2 work.
- `bin/render-report.js` renders `summary.json` into the Markdown and HTML
  reports.
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

Say this to the user if they seem to expect otherwise. Overclaiming what a
read-only review proves is its own kind of security failure.
