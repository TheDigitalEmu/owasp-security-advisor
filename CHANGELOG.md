# Changelog

All notable changes to this project are documented here.

Format based on Keep a Changelog. This project adheres to Semantic Versioning.

## [1.5.0] - 2026-09-14

Closes the four known gaps left open in prior releases.

### Added

- **`bin/consensus.js`** reduces the run-to-run drift in the finding set and
  ratings. It combines N independent review passes over the same fixed
  enumeration: any pass finding an element means finding (union), a finding's
  matrix axes take the highest cited level, and its verification axes take the
  most cautious value. It records a per-finding `ratingDivergence` and a
  document-level `disagreementRate`, which the report presents as a stability
  measure, never as completeness or correctness. Sweep runs three passes by
  default, Review one. Proven to converge the postcss/CSP Info-vs-Low flip to a
  stable Info.

### Changed

- **`bin/enumerate.js`** now uses a declarative profile table covering next,
  express, django, flask, rails, go, and php, with detection by file list as
  well as package.json. When no profile matches it declares
  `manualEnumerationRequired` loudly, and it warns when a matched profile finds
  zero entry points (usually a broken rule, not a surfaceless app).
- Node-absence is no longer silent. Step 5 preflights `node --version`; if Node
  is missing, the summary carries `renderStatus` and no `score` block, and a
  grade with no `score.computedBy` is labelled hand-computed and unrendered.
- `bin/render-report.js` surfaces the consensus disagreement rate with its
  stability-not-correctness caveat.
- Build mode (`doctrine/20`) gains a mandatory adversarial second pass on the
  diff and a `signOff` field whose role must be human or second-model. The tool
  refuses to claim independent review while sign-off is by the author.
- `summary.schema.json` gains `consensus`, `renderStatus`, per-finding
  `ratingSamples`/`ratingDivergence` (additive, backward compatible).

### Honest limit

- Consensus reduces variance, not bias. N passes by one model share blind spots,
  agree with each other, and can be identically wrong. Only heterogeneous
  samplers (a different model, or a human) make agreement mean more than
  consistency. The report says so.

## [1.4.1] - 2026-09-14

### Fixed

- `SYSTEM_PROMPT.md` still described the old two-mode model ("if unsure, review",
  and "sweep" grouped with fix/harden as build). This contradicted the
  three-mode SKILL.md, so a non-Claude agent pasting it got the wrong behaviour.
  Rewritten to the three modes (Review, Sweep, Build) with the same word-picks-mode
  and no-silent-guess rules, and the tool-layer read-only note now names Review
  and Sweep.
- `bin/render-report.js` now surfaces the enumeration `entrySource`. When the
  attack-surface denominator was best-effort (no framework profile matched, e.g.
  a Python or shell tree), the report says so, so coverage is not read as
  mechanically anchored when it was guessed by file name.
- Section 9 states plainly that a report from this protocol is not an independent
  security sign-off (a read is not an attack; in Build the author and reviewer
  are one model), and says to hand that caveat back with the grade.
- `BOOTSTRAP.md` points non-Claude agents to the plain-clone path up front.
- GitHub repository description set (was a stub).

## [1.4.0] - 2026-09-13

### Fixed

- Self-referential coverage. Coverage was traced-over-enumerated where the
  review authored both numbers in the same pass, so it traced everything it
  noticed and reported 100% no matter how little it looked at. On one real repo
  at one commit, runs enumerated 11, 12, and 13 entry points and all reported
  100%, while an independent mechanical count found 14. A run that discovered 2
  findings looked identical to one that discovered 6.
  - New `bin/enumerate.js` derives the attack-surface denominator from the code:
    entry points by framework file-shape rules (Next.js profile, generic
    fallback) plus the fixed ten sink classes. Its output is identical on every
    run of the same commit.
  - `bin/render-report.js` now computes coverage from a required per-element
    verdict (clear, finding, gap) in a new `enumeration` block, not from
    hand-authored integers. An element with no verdict counts as a gap and
    lowers coverage, so a shallow review can no longer report a false 100%.
    `--strict` refuses to render while any enumerated element is unaccounted for.
  - `summary.schema.json` gains the `enumeration` block (either it or the legacy
    `coverage` block is required). `doctrine/06` Phase 6 and `rubrics/scoring.md`
    section 4 rewritten to require the derived denominator.

### Honest limit

- This makes coverage honest and fixes the fake-100%. It does not make the set
  of discovered findings identical run to run: two runs can now agree on the
  attack surface and disclose how much of it each examined, but can still
  disagree on whether a given element harbours a finding. Eliminating that
  residual needs multi-sample enumeration (a cost increase) or a static-analysis
  engine, not a prompt.

## [1.3.0] - 2026-09-13

### Changed

- Three explicit modes replace the old two-mode split, and the skill no longer
  guesses which one you meant. On a bare `/owasp-advisor` call it asks which
  mode; a mode word or clear intent in the request selects it directly, and a
  single ambiguous mode word is confirmed before running.
  - **Review** (read-only): one management-facing scored document at
    `reviews/review-<YYYYMMDD>-<HHMM>.md`, dated so reviews never overwrite each
    other.
  - **Sweep** (read-only): the full in-depth report in its own dated folder
    `sweeps/<YYYYMMDD>-<HHMM>-<short-name>/`.
  - **Build** (writes code): remediates a sweep's findings. It uses a specified
    sweep, or the last-hour sweep automatically, asks about an earlier same-day
    sweep, and otherwise runs a fresh sweep first. Also triggered by fix, harden,
    remediate, patch.
- Rule 1 now names Review and Sweep as the read-only modes. Rule 4 gains a
  scoped exception so Build can follow a project rule that requires a worktree
  branch, with the first push and deploy still the user's explicit call.
- Output layout (section 6) and the procedure header updated for the three
  modes.

## [1.2.1] - 2026-09-13

### Fixed

- "Sweep" was ambiguous and defaulted to review mode. The word "sweep" appeared
  in the review-trigger list, so a user asking for a sweep got a read-only
  review with no sweep folder, no code changes, and no journal. Mode selection
  is now a table keyed on the user's verb, and "sweep" maps unambiguously to
  build mode. The build-mode section states that the sweep folder under
  `sweeps/<YYYYMMDD>-<HHMM>-<short-name>/` is created before the first commit,
  and the skill must say the chosen mode back in its first sentence and never
  silently downgrade a sweep to a review.

## [1.2.0] - 2026-09-13

### Changed

- Reproducibility. Three runs of the same repo at the same commit produced
  different grades (a HIGH finding, an A, and a B) because the reviewer assigned
  impact and reachability by judgment, and one run silently missed findings.
  Two changes pin this:
  - Axis values must now be earned with a citation, not asserted. The impact and
    reachability tables in `rubrics/scoring.md` state, per level, the fact that
    admits it, and a new Axis justification block in
    `doctrine/07-findings-template.md` forces the reviewer to cite the file:line
    that satisfies the level or drop to the floor. Constrained reachability and
    Moderate impact and above require a positive citation of a confirmed fact.
  - Coverage is now a recorded verdict per enumerated element. Phase 6 of
    `doctrine/06-investigation-playbook.md` requires clear / finding / gap on
    every entry point and sink, so a silently skipped area becomes a coverage
    debit rather than an invisible omission.
- `rubrics/scoring.md` gains a Reproducibility section stating honestly what is
  pinned (axis drift, missed coverage) and the residue that remains (a cited
  line still has to be read correctly; discovery is still an LLM).

## [1.1.1] - 2026-09-13

### Fixed

- The report was not being produced. Step 5 said only "render with templates/"
  and the helper scripts were labelled optional, so a review would end in chat
  prose with no `report.html` and no score. Step 5 is now an explicit, mandatory
  procedure (write `summary.json`, run `bin/render-report.js`, confirm the
  outputs exist), and the same instruction was corrected in `BOOTSTRAP.md` and
  `SYSTEM_PROMPT.md`. `render-report.js` is no longer described as optional.

## [1.1.0] - 2026-09-13

### Added

- `doctrine/00-currency-log.md`: audit trail of which OWASP standards the skill
  tracks, their state, and how to run a currency check.
- `doctrine/01-update-protocol.md`: self-update protocol. A third mode (update)
  alongside review and build. Read local version, compare upstream, confirm,
  fast-forward pull, verify.
- `bin/version.js`: prints the installed version and, with `--check`, compares
  it against the upstream git tag. Exit 10 when an update is available.
- `examples/summary.json`: a valid minimal summary for the install smoke test
  and as an authoring reference.
- `version:` field in `SKILL.md` frontmatter, now the authoritative version.

### Changed

- Skill name is now `owasp-advisor` (was `owasp-security-advisor`). The install
  directory changes to match; the GitHub repository name is unchanged.
- Top 10 updated from 2021 to 2025 (`doctrine/04` rewritten; SSRF folded into
  A01; new A03 Software Supply Chain Failures and A10 Mishandling of Exceptional
  Conditions; renames and re-rankings). Category citations updated across
  `doctrine/07, 08, 09, 10, 13, 15, 18` and the top-level alignment statements.
- Proactive Controls label corrected from "v4" to the 2024 edition. Control
  names were already the 2024 set; only the label changed.
- `BOOTSTRAP.md` verify steps use install-relative bin paths and add a fixture
  smoke test and a version check.

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
