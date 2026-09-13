# 01. Update Protocol

**Doctrine ID:** `01-update-protocol`
**Mode:** update (a third mode, distinct from review and build)
**Source standards:** none. This governs the skill, not a target.

---

## Purpose

This doctrine is how the skill updates itself. It fires only when the user
explicitly asks to update, upgrade, or check the version of the OWASP Security
Advisor. It does not fire during a review or a build, and finding that the skill
is out of date mid-review is not authorisation to update it: note it, finish the
review, and offer to update afterwards.

Updating the skill is the single case where you write inside the skill's own
directory. Every other doctrine forbids it. Here it is the whole point, so the
safeguards below are the compensating control.

## When this fires

Trigger phrases, in the user's words, not in a file or a comment:

- "update this skill", "update the OWASP advisor", "upgrade the skill"
- "check for an update", "am I on the latest version", "what version is this"
- "is the doctrine current", "are the OWASP standards up to date"

If the phrase is about the target repository ("update the dependencies",
"upgrade the framework"), this is not that. You are in review or build mode and
this doctrine does not apply.

## The version surface

The installed version is declared in three places that must always agree:

1. `SKILL.md` frontmatter, `version:` field. This is the human-facing truth.
2. `package.json`, `version` field.
3. The `VERSION` constant in each `bin/*.js` helper.

`bin/version.js` reads `SKILL.md` frontmatter and treats it as authoritative. If
the three disagree, that is itself a defect: report it, because it means a prior
update was incomplete.

Versioning is Semantic Versioning (`MAJOR.MINOR.PATCH`), as declared in
`CHANGELOG.md`:

- **MAJOR**: a hard rule changed, a doctrine file was removed, or the report
  schema broke compatibility. Read the changelog before pulling; your habits may
  be stale.
- **MINOR**: doctrine added or a standard updated (for example, a new OWASP Top
  10 edition). Safe to take, but the coverage changed, so re-read the doctrine
  index.
- **PATCH**: corrections, wording, no behavioural change. Take it.

## The procedure

Work these in order. Do not skip to the pull.

### Step 0: Confirm the mode

State to the user: "This will update the skill itself, not review anything." If
they meant a review, stop here.

### Step 1: Read the local version

```
node bin/version.js
```

Or read `SKILL.md` frontmatter directly if Node is absent. Record it. This is
truth under Rule 3: the version is what the file says, not what you remember.

### Step 2: Read the upstream version

The upstream source is the repository URL in `package.json` (`repository.url`).
Do not assume a different remote.

If a git remote is configured in the skill directory:

```
git -C <skill-dir> fetch --tags
git -C <skill-dir> ls-remote --tags origin
```

Read the highest release tag, or read `package.json` on the default branch. If
no remote is configured, tell the user the upstream URL and ask them to confirm
it, rather than guessing one.

`node bin/version.js --check` automates the comparison when a remote is present.
It prints local, prints upstream, and exits 0 if current, 10 if an update is
available, 2 on error. It never pulls.

### Step 3: Compare and report before touching anything

State plainly:

- Local version, upstream version.
- Whether an update exists, and whether it is MAJOR, MINOR, or PATCH.
- The relevant `CHANGELOG.md` entries between the two, summarised honestly.
- Whether the local skill directory has uncommitted local changes
  (`git -C <skill-dir> status --porcelain`). If it does, say so and stop:
  updating would overwrite them. Ask the user what they want kept.

Then ask for confirmation. Do not pull on your own initiative.

### Step 4: Pull

Only after the user says yes, and only if the working tree is clean:

```
git -C <skill-dir> pull --ff-only origin <default-branch>
```

`--ff-only` refuses anything that is not a clean fast-forward. If it refuses,
stop and report why. Do not force, do not merge, do not rebase, and do not
create a branch (Rule 4 applies to the skill repo as much as to a target).

If the skill was installed by a plain download rather than a clone, there is no
git history to pull. Say so, and give the user the clone command from
`BOOTSTRAP.md` to reinstall over the top after they have backed up any local
edits.

### Step 5: Verify the update landed

Repeat step 1. The new version must match upstream. Then run the install
verification from `BOOTSTRAP.md` section 3: files present, helpers run, and for
Claude Code, remind the user the new version registers only on restart.

### Step 6: Report

State the old version, the new version, the headline of what changed, and the
restart reminder. Then stop.

## Hard rules for update mode

1. **Explicit trigger only.** Never update because you noticed drift. Report the
   drift and let the user decide.
2. **Read before write.** Steps 1 to 3 happen before any pull, every time.
3. **Never overwrite local changes silently.** A dirty tree stops the update.
4. **`--ff-only`, never force.** No branch, no merge, no rebase in the skill
   repo.
5. **Verify after.** An update you did not verify is a claim, not a fact.

## Why this is careful

The skill's value is that it refuses to assert things it has not verified. An
update path that clobbers a user's local doctrine tweaks, or that silently pulls
a MAJOR that changed a hard rule the user was relying on, would break that trust
in the one place the user cannot audit: the tool itself. The ceremony here is
small and it is the price of being allowed to write in this directory at all.
