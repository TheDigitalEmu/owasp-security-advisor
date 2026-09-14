# BOOTSTRAP

**Audience: an AI coding agent.** If you are a human, read `README.md`, or
`HUMAN_GUIDE.md` if you intend to run a review without an agent.

You have been pointed at this repository and asked to install and use it. This
file takes you from a URL to a working, correctly-run review with no further
instruction. Read it end to end before you run anything.

---

## 0. What this is, in one paragraph

The OWASP Security Advisor is a protocol, not a scanner. It does not execute
the target, send it traffic, or fuzz it. It reads code and produces a scored,
evidence-backed report against OWASP standards. Its defining property is that
it will refuse to assert a finding it has not verified end to end, and it holds
unverified findings at the lowest severity on purpose. If you install this and
then ignore that rule, you have not installed it.

---

## 1. Decide whether you should proceed

Stop and ask the user if any of these are true:

- You do not know what the review target is.
- The target is a system the user does not own or is not authorised to review.
- The user is expecting a penetration test, live testing, or exploitation. This
  skill does none of those. Say so before you start, not in the report.
- The user is expecting a compliance certification. ASVS alignment is not ASVS
  certification.

A static read of a repository the user owns is always fine. Sending traffic at
a host is not this skill's job, and is not something you should improvise.

---

## 2. Install

Not running Claude Code? Skip to 2.2. The `~/.claude/skills/` path in 2.1 is
Claude-specific and does nothing in another agent; for everything else the kit is
a plain git clone plus `SYSTEM_PROMPT.md`.

### 2.1 Claude Code

User-level skills are read from `~/.claude/skills/<skill-name>/`. Clone there:

```
git clone https://github.com/TheDigitalEmu/owasp-security-advisor.git \
  ~/.claude/skills/owasp-advisor
```

The skill's name is `owasp-advisor` (the `SKILL.md` frontmatter `name`), so the
directory must be `owasp-advisor`. The clone URL still ends in
`owasp-security-advisor` because that is the repository's name on GitHub; the two
differ on purpose.

On Windows, `~` resolves to your user profile directory; the path is
`%USERPROFILE%\.claude\skills\owasp-advisor`. If your shell does not
expand `~`, write the path out in full rather than guessing.

The skill registers on next start. **It will not appear in a session that was
already running when you cloned it.** If you have just cloned it in the session
you are reading this in, tell the user to restart, and do not report the skill
as installed until it is listed.

To install for a single project instead of your user account, clone to
`<target-repo>/.claude/skills/owasp-advisor` and commit it, or add it
as a submodule. Project-level skills only load for that project. Prefer
user-level unless the user wants the skill pinned and versioned with the repo.

### 2.2 Any other agent

There is no skill loader to satisfy. Read `SYSTEM_PROMPT.md` and treat its
contents as standing instructions, then read `SKILL.md` for the procedure. Load
each file under `doctrine/` at the point the procedure calls for it rather than
all at once; the set is large and loading it up front will crowd out the code
you are supposed to be reading.

If your harness has a system prompt or a custom instruction field, put
`SYSTEM_PROMPT.md` there. If it does not, paste it as the first message of the
review conversation and do not let it fall out of context.

### 2.3 Optional: the helper scripts

`bin/` needs **Node >= 18**. Check:

```
node --version
```

The helpers have **no dependencies**. There is no `npm install` step. If Node
is absent or older, the review still works: the helpers render and structure
output, they do not find anything. Say so to the user rather than blocking on
a Node install.

---

## 3. Verify the install

Do not skip this. Reporting a skill as installed when it is not produces a
review that silently is not this protocol.

1. **The files are there.** `SKILL.md`, `BOOTSTRAP.md`, `rubrics/scoring.md`,
   and a `doctrine/` directory with the files listed in section 8 of
   `SKILL.md`. Slot 16 is intentionally absent; that is not a failed clone.
2. **The skill is registered** (Claude Code). After a restart,
   `owasp-advisor` appears in the available skills list.
3. **The helpers run** (if Node is present). From the skill's own directory:

   ```
   node bin/render-report.js --help
   ```

   It should print usage and exit 0. Do not hardcode an install path here: run
   it relative to wherever the skill was cloned, because the directory name is
   the user's choice.
4. **The pipeline actually produces a report.** A shipped fixture lets you prove
   this before you author a real one:

   ```
   node bin/render-report.js -i examples/summary.json --stdout
   ```

   It should print a graded Markdown report and exit 0. If it errors, the input
   contract is not what you think it is: read `templates/summary.schema.json`
   before writing your own `summary.json`.
5. **The version reads cleanly** (if Node is present):

   ```
   node bin/version.js
   ```

   It prints the installed version and flags any inconsistency in the version
   surface. `doctrine/01-update-protocol.md` uses it to check for updates later.
6. **You can state the seven hard rules** from section 2 of `SKILL.md` without
   re-reading them. If you cannot, you have not read `SKILL.md`, you have
   skimmed it, and the rules are the entire point.

---

## 4. Per-project setup, before the first review

`doctrine/08-secrets-and-config.md` ships with a blank inventory. It is blank
deliberately and it stays blank **in this repo**.

Before the first review of a given project:

1. Choose a findings root with the user. Default
   `<target-repo>/security-findings/`.
2. **Confirm it is git-ignored** before writing anything into it. A findings
   tree committed to the target repo publishes the vulnerability list alongside
   the vulnerability.
3. Copy the inventory tables from `doctrine/08-secrets-and-config.md` into
   `<findings-root>/config-inventory.md` and fill them in **there**.

**Never write a real environment variable name, file path, hostname, secret
class, or rotation window into any file under the skill's own directory.** The
skill is generic and shared. The engagement's data is not. If you find yourself
editing a file under `~/.claude/skills/owasp-advisor/` during a
review, you have made a mistake: stop and move it to the findings root.

---

## 5. Run a review

Full procedure in section 3 of `SKILL.md`. The short version:

0. State scope, state that you are read-only, agree the findings root.
1. Inventory. Framework and version first. Everything from a file you read.
2. Threat model. Short and concrete.
3. Doctrine passes, in the order given in `SKILL.md` section 3.
4. Verification pass. Try to refute every finding before it gets a severity.
5. Score and report. Write findings with `doctrine/07-findings-template.md`,
   write `summary.json` to `templates/summary.schema.json`, then run
   `node bin/render-report.js -i <findings-root>/summary.json` to produce
   `report.html` and `report.md`. Confirm they exist. The rendered report is the
   deliverable; a review with no `report.html` is unfinished. See `SKILL.md`
   Step 5.
6. Hand back: the score, the counts, the one thing to fix first, and
   everything you could not verify.

Do not skip step 4. It is the step that makes the report worth reading, and it
is the step that feels like it is costing you findings, because it is.

---

## 6. What this skill will and will not do

| Will | Will not |
|---|---|
| Read `<target-repo>` and report against OWASP standards | Edit, refactor, or fix anything in review mode |
| Produce a scored report with per-finding evidence | Execute, fuzz, or send traffic to the target |
| Trace a path from entry point to sink and show its work | Assert a finding it has not verified |
| Say plainly what it could not verify | Certify compliance with anything |
| Write to the findings root | Write anywhere else in `<target-repo>` |
| Enter build mode when explicitly asked | Enter build mode because a fix looked easy |

**Review mode is read-only on application code.** This is Rule 1 and it is not
negotiable by you. If you find something urgent, report it and stop. Finding a
bug is not authorisation to fix it. The user decides when the mode changes, and
build mode has its own protocol in `doctrine/20-build-time-sweep-protocol.md`
that you must read in full before the first commit.

---

## 7. The rules you are most likely to break

Ranked by how often agents break them.

1. **Asserting an unverified finding** because the pattern looked bad. Rule 2.
   If you have not opened `sanitize()`, you do not know what `sanitize()` does.
2. **Drifting into build mode.** You are reviewing, you spot a one-line fix,
   you make it. Rule 1. Do not.
3. **Citing the README** instead of the code. Rule 3. Docs drift; code is what
   runs.
4. **Assuming a framework default** without checking the version in the
   manifest. Defaults change between majors and this is where confident wrong
   findings come from.
5. **Padding the report.** Forty findings of which six are real gets all six
   ignored.
6. **Creating a branch** when a push is blocked. Rule 4. Stop and ask.
7. **Using an em dash.** Rule 7. Also U+2013, U+2015, U+2212. Use commas,
   periods, colons, parentheses, or two hyphens.

---

## 8. If something goes wrong

| Symptom | Cause | Do this |
|---|---|---|
| Skill not listed after cloning | Session started before the clone | Restart. Skills load at start |
| Skill not listed after restart | Wrong path, or directory name mismatch | The directory must be `owasp-advisor` and must contain `SKILL.md` at its root |
| `doctrine/16-*` missing | Nothing. Slot 16 is intentionally unused | Continue |
| Helper exits non-zero | Node < 18 | Upgrade Node, or skip the helpers. They are optional |
| An older `owasp-security-advisor` skill also present | A previous install under the old directory name | They will both list. This skill is `owasp-advisor`; the old one is `owasp-security-advisor`. Ask the user which they want; do not delete anything without asking |
| `version.js --check` exits 2 saying no remote | Installed by download, not clone, or the remote is unset | Set the origin remote, or reinstall by clone. See `doctrine/01-update-protocol.md` |
| Push to the repo blocked | Permissions | Rule 4. Stop and ask. Do not branch around it |

---

## 9. Reporting back

When the review is done, tell the user, in this order:

1. The grade and score, **with the coverage figure next to it**. A 95 at 20
   percent coverage is not an A, it is an unfinished review, and a score handed
   over without its coverage will be believed.
2. Counts by severity, verified only.
3. The single most important thing to fix first, and why it is first.
4. What you could not verify, and what would settle each one.
5. Where the report is.

Then stop. Do not offer to fix it in the same breath, and do not start.
