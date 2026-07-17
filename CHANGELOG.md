# Changelog

All notable changes to this project are documented here.

Format based on Keep a Changelog. This project adheres to Semantic Versioning.

## [1.0.0] - 2026-07-17

First public release.

### Added

- `SKILL.md`: skill entry point. Seven hard rules, the review procedure, and
  the review/build mode split.
- `BOOTSTRAP.md`: self-bootstrapping install and first-run guide written for an
  AI agent. Takes an agent from a repository URL to a correctly-run review
  without further instruction.
- `SYSTEM_PROMPT.md`: standing instructions for agents without a skill loader.
- `HUMAN_GUIDE.md`: the procedure for a human reviewer working without an AI.
- `rubrics/scoring.md`: deterministic severity model. Impact multiplied by
  reachability, capped by a verification ceiling, plus the posture score and
  coverage reporting rules.
- Doctrine set:
  - `02-asvs-checklist.md`, ASVS 5.0 coverage backstop
  - `03-api-top10-checklist.md`, API Security Top 10 (2023)
  - `04-web-top10-checklist.md`, Top 10 (2021)
  - `05-proactive-controls.md`, Proactive Controls v4
  - `06-investigation-playbook.md`, investigation procedure
  - `07-findings-template.md`, the shape of a finding
  - `08-secrets-and-config.md`, blank per-project secret inventory
  - `09-dependency-supply-chain.md`
  - `10-logging-monitoring.md`
  - `11-incident-response.md`
  - `12-secure-code-review.md`
  - `13-auth-and-session.md`
  - `14-file-upload.md`
  - `15-database-access.md`
  - `17-rate-limit-abuse.md`
  - `18-privacy-and-data-protection.md`
  - `19-vulnerability-disclosure.md`
  - `20-build-time-sweep-protocol.md`, build mode
- `templates/`: summary JSON schema, Markdown report, HTML report.
- `bin/reachability.js`, `bin/render-report.js`, `bin/deployment-report.js`.
  Optional Node >= 18 helpers, no dependencies.

### Notes

- Doctrine slot `16` is intentionally unused. Do not fill it.
- The journal layout in `20-build-time-sweep-protocol.md` reserves slot `03`
  and intentionally leaves it unused.
- Written from public OWASP standards only. This repository has no history
  prior to 1.0.0 by design.
