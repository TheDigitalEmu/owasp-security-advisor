# 00. Currency Log

**Doctrine ID:** `00-currency-log`
**Mode:** reference
**Source standards:** tracks all of them

---

## Purpose

This file records the state of the OWASP standards the skill aligns to, when
each was last checked, and what changed. It is the audit trail behind the
alignment claim in `SKILL.md`. When someone asks "is this current", this file is
the answer, and `doctrine/01-update-protocol.md` is how you act on it.

A standard the skill claims alignment to but has not tracked here is a claim
without evidence, which is exactly the thing this skill exists to refuse.

## Standards tracked

Last reviewed: 2026-09-13.

| Standard | Version the skill aligns to | Latest published | Current? | Notes |
|---|---|---|---|---|
| ASVS | 5.0 (May 2025) | 5.0 | yes | Next is a 5.0.1 patch. No action. |
| Top 10 (web) | 2025 (final Jan 2026) | 2025 | yes | Updated from 2021 in skill 1.1.0. See below. |
| API Security Top 10 | 2023 | 2023 | yes | No 2025 or 2026 edition exists. The 2023 list is authoritative. |
| Proactive Controls | 2024 | 2024 | yes | Label corrected from "v4" in skill 1.1.0; control names were already the 2024 set. A future edition is listed as work in progress upstream. |
| Cheat Sheet Series | rolling | rolling | yes | Not versioned. Cited by sheet name, which is stable. |
| CWE | unpinned | rolling | n/a | Used as a vocabulary, not a scored model. No version pinned by design. |
| MASVS (mobile) | not adopted | 2.x | n/a | The skill has no mobile coverage. If a mobile target appears, this is the gap to fill. |

## Change record

### 2026-09-13, skill 1.1.0: Top 10 2021 to 2025

The OWASP Top 10:2025 was finalised in January 2026. The skill was updated from
the 2021 edition. What changed, and how it was applied:

**New categories**

- **A03:2025 Software Supply Chain Failures.** Expands the 2021 A06 Vulnerable
  and Outdated Components into the whole build and dependency chain. Role in the
  skill: `doctrine/04` A03 rows, backed by the existing
  `doctrine/09-dependency-supply-chain.md`, which already covered this ground and
  needed only its category citation updated.
- **A10:2025 Mishandling of Exceptional Conditions.** Entirely new. Covers what
  the code does on the error path, where security decisions quietly invert.
  Role in the skill: new A10 rows in `doctrine/04`, focused on fail-closed
  behaviour, default-deny branches, and swallowed control failures. No prior
  doctrine covered this specifically; the rows are the coverage.

**Merges**

- **SSRF** (2021 A10, a standalone category) folded into **A01 Broken Access
  Control**. Applied as rows 04.1.9 to 04.1.13 in `doctrine/04`. The SSRF checks
  were retained in full; only their filing changed.

**Renames**

- A07 Identification and Authentication Failures becomes **Authentication
  Failures**.
- A09 Security Logging and Monitoring Failures becomes **Security Logging and
  Alerting Failures**.

**Re-rankings (filing only, no severity effect)**

- Security Misconfiguration 2021 A05 to 2025 A02.
- Cryptographic Failures 2021 A02 to 2025 A04.
- Injection 2021 A03 to 2025 A05.
- Insecure Design 2021 A04 to 2025 A06.

**Where the numbers were updated**

`doctrine/04` (full rewrite), plus the category citations in the source-standards
headers of `doctrine/08`, `09`, `10`, `13`, `15`, `18`, and the example in
`doctrine/07`. The top-level alignment statement was updated in `SKILL.md`,
`README.md`, `SYSTEM_PROMPT.md`, and `package.json`.

**Does 2025 supersede 2021 for this skill?** Yes, completely. The 2021 edition
is retained only as historical context inside `doctrine/04`, so a reader
understands what moved. All active citations are 2025.

### 2026-09-13, skill 1.1.0: Proactive Controls label

The skill cited "Proactive Controls v4". The current edition is the 2024
edition, and its ten control names (C1 Implement Access Control through C10 Stop
Server Side Request Forgery) already matched what `doctrine/05` used. Only the
version label was wrong. Corrected in `doctrine/05`, `doctrine/20`, and the
top-level alignment statements. No control content changed.

## How to run a currency check

This is a periodic maintenance task, not part of a review. Roughly twice a year,
or when a user asks whether the standards are current:

1. For each standard in the table above, read the official OWASP project page
   and record the latest published version and date.
2. Compare against the "aligns to" column. If they match, update the
   "Last reviewed" date and stop.
3. If a standard has a newer version, do not silently rewrite the doctrine.
   First add a row to the change record describing what changed, what it
   supersedes, and which doctrine files carry the affected content.
4. Then apply the change to the doctrine, following the same pattern as the
   Top 10 2025 update above: rewrite the checklist file, update every category
   citation in the source-standards headers, update the top-level alignment
   statements, and bump the skill version per `doctrine/01-update-protocol.md`
   (a standard update is a MINOR bump).
5. Record the review in this file. The audit trail is the deliverable.

## Migration pathway for an installed skill

When this repo is updated to a newer standard, an installed skill is brought
current by the self-update protocol in `doctrine/01-update-protocol.md`:
`bin/version.js --check` detects the new version, the user confirms, and a
fast-forward pull brings the new doctrine down. A standard update is always at
least a MINOR bump, so `--check` will flag it and the user is told to re-read
the doctrine index because coverage changed.

Official project pages, for step 1:

- ASVS: `https://owasp.org/www-project-application-security-verification-standard/`
- Top 10: `https://top10.owasp.org/`
- API Security Top 10: `https://owasp.org/API-Security/`
- Proactive Controls: `https://top10proactive.owasp.org/`
- Cheat Sheet Series: `https://cheatsheetseries.owasp.org/`
