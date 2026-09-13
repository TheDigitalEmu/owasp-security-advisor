# OWASP Security Advisor

An OWASP-aligned security review protocol for AI coding agents and human
reviewers. It produces a scored, evidence-backed report against ASVS 5.0, the
Top 10 (2025), the API Security Top 10 (2023), Proactive Controls 2024, and the
Cheat Sheet Series.

It is read-only on your application code. It does not run your code, send it
traffic, or try to exploit it.

**MIT licensed.** Copy it, fork it, change it.

---

## The point

An AI agent asked to "review this for security" will produce something that
reads beautifully and is roughly 40 percent invented. It will report the
concatenated query without checking whether anything reaches it. It will trust
a function called `sanitize()` because of what it is called. It will grade your
app an A after reading a fifth of it.

This protocol exists to stop that. Its defining rule:

> **A finding you have not verified end to end is not a finding.**

If the reviewer cannot trace the path from the entry point to the dangerous
operation, reading every wrapper and middleware on the way, the finding is
marked unverified and held at the lowest severity. Not dropped, not softened
with a hedge: held, visibly, with a note saying what would settle it.

This costs findings. That is the intent. A report with one confident wrong
finding gets the whole report ignored, and the reviewer who produced it stops
being read.

## Install

### For an AI agent

Point it at this repository and it can install itself. That is what
[`BOOTSTRAP.md`](BOOTSTRAP.md) is for: it takes an agent from this URL to a
correctly-run review with no further instruction from you.

### Claude Code

```
git clone https://github.com/TheDigitalEmu/owasp-security-advisor.git \
  ~/.claude/skills/owasp-advisor
```

The skill is named `owasp-advisor`, so the directory is `owasp-advisor`. The
clone URL keeps the repository's GitHub name, `owasp-security-advisor`.

Restart. Then ask for a security review in whatever words you would normally
use.

### Other agents

Put [`SYSTEM_PROMPT.md`](SYSTEM_PROMPT.md) in your system prompt.
[`SKILL.md`](SKILL.md) is the full procedure.

### No AI at all

[`HUMAN_GUIDE.md`](HUMAN_GUIDE.md) is the same protocol for a human reviewer
with a text editor. The doctrine is the same; only the reader changes.

### Optional helpers

`bin/` needs Node >= 18 and has no dependencies. There is no install step. The
review works without them; they render and structure output, they do not find
anything.

## What you get

```
<findings-root>/
  report.html          dashboard: grade, counts, coverage
  report.md            the same, in Markdown
  summary.json         machine-readable
  inventory.md         what is actually in the codebase
  threat-model.md      who the adversary is and what they want
  findings/            one file per finding, each with its trace
  unverified.md        what could not be verified, and what would settle it
```

The grade is computed, not vibed. Severity is impact multiplied by
reachability, capped by how well the finding was verified.
[`rubrics/scoring.md`](rubrics/scoring.md) is the whole model, and
`bin/render-report.js` implements it exactly.

**Coverage is reported next to the grade, always.** A 95 at 20 percent coverage
is not an A, it is an unfinished review, and the report says so in those words.

## Two modes

**Review mode** is the default and is read-only. It produces a report. It does
not touch your code, and it will not fix something because the fix looked easy.

**Build mode** writes code, and only when you explicitly ask. Every commit
lands with its own OWASP self-review in the journal, in the same commit:
categories touched, controls present, trade-offs named, verdict. One commit per
item, each individually revertable, test suite green after every one and the
test count never regressing. Deleting suspected dead code requires a grep gate
with the raw transcript recorded as evidence.

The reason for all that ceremony: in build mode the author and the reviewer are
the same agent, and nobody is checking it.
[`doctrine/20-build-time-sweep-protocol.md`](doctrine/20-build-time-sweep-protocol.md)
is the compensating control.

## What it will not do

- Run, fuzz, or send traffic to your application. It reads code.
- Fix things in review mode.
- Certify compliance. ASVS alignment is not ASVS certification.
- Replace a human reviewer on anything that matters.
- Tell you an area is safe because it did not look at it.

## Doctrine

| File | Scope |
|---|---|
| [`00`](doctrine/00-currency-log.md) | Which OWASP standards the skill tracks, and their state |
| [`01`](doctrine/01-update-protocol.md) | Self-update. How the skill checks its version and upgrades |
| [`02`](doctrine/02-asvs-checklist.md) | ASVS 5.0 coverage backstop |
| [`03`](doctrine/03-api-top10-checklist.md) | API Security Top 10 (2023) |
| [`04`](doctrine/04-web-top10-checklist.md) | Top 10 (2025) |
| [`05`](doctrine/05-proactive-controls.md) | Proactive Controls 2024 |
| [`06`](doctrine/06-investigation-playbook.md) | How to investigate. The method |
| [`07`](doctrine/07-findings-template.md) | The shape of a finding |
| [`08`](doctrine/08-secrets-and-config.md) | Secrets and configuration |
| [`09`](doctrine/09-dependency-supply-chain.md) | Dependencies and supply chain |
| [`10`](doctrine/10-logging-monitoring.md) | Logging and monitoring |
| [`11`](doctrine/11-incident-response.md) | Incident response |
| [`12`](doctrine/12-secure-code-review.md) | Secure code review practice |
| [`13`](doctrine/13-auth-and-session.md) | Auth, authorization, session |
| [`14`](doctrine/14-file-upload.md) | File upload |
| [`15`](doctrine/15-database-access.md) | Database and data access |
| [`17`](doctrine/17-rate-limit-abuse.md) | Rate limiting and abuse |
| [`18`](doctrine/18-privacy-and-data-protection.md) | Privacy and personal data |
| [`19`](doctrine/19-vulnerability-disclosure.md) | Vulnerability disclosure |
| [`20`](doctrine/20-build-time-sweep-protocol.md) | Build mode |

Slot 16 is intentionally unused.

Each doctrine file ships its checklist with the Evidence and Verdict columns
**blank**. They are filled per engagement, in the findings root, never in this
repo. The inventory tables in `08` and `18` ship empty for the same reason: a
completed secret inventory is a map of a live system, and it does not belong in
a shared skill.

## Your data stays yours

This repo is generic on purpose and stays that way. Everything a review learns
about a real system goes to the findings root, which the protocol requires be
git-ignored before anything is written to it. Nothing in this repository should
ever name a real host, path, environment variable, or secret. If a
contribution does, that is a bug, and a serious one.

## Contributing

Issues and pull requests welcome. Two rules that are not negotiable:

1. **No client data, ever.** No real hostnames, paths, environment variable
   names, or secret classes. Use the placeholders: `<target-repo>`,
   `<backend>/`, `<frontend>/`, `<entry-point>`, `<findings-root>`. Name the
   class of a thing ("the identity provider"), never the vendor.
2. **No em dashes** or dash look-alikes (U+2014, U+2013, U+2015, U+2212)
   anywhere. Commas, periods, colons, parentheses, or two hyphens.

Every checklist row you add must be a control someone can verify by reading
code. If it cannot be checked, it is not a control, it is a wish.

## Security

This project ships documentation and three dependency-free Node scripts. If you
find something wrong with it, open an issue. If you find something wrong with
an application while using it, that is between you and the application's owner:
see [`doctrine/19-vulnerability-disclosure.md`](doctrine/19-vulnerability-disclosure.md)
for how to report it well.

## Licence

MIT. Copyright (c) 2026 Digital Emu. See [`LICENSE`](LICENSE).
