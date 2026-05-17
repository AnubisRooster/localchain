---
name: gitlab-skill
description: >
  Use this skill for GitLab repository operations that should be performed consistently across teams:
  creating and updating files, branching strategy, merge request workflows, and repository
  standardization tasks. Apply when users ask to publish skills, sync operational docs, open MRs,
  or automate codebase updates in self-hosted or cloud GitLab.
---

# GitLab Operational Skill

This skill defines a standard way to use GitLab for operational automation and
shared documentation updates.

## Purpose

Use GitLab as a controlled delivery layer for operational artifacts (such as
`SKILL.md` and `README` files) so teams execute the same workflows, with the
same review expectations, and the same structure.

## When to use

Trigger this skill when the user asks to:

- Create/update repository files in GitLab.
- Publish or synchronize skill documentation.
- Create feature branches and merge requests.
- Standardize repository structure for shared operational assets.

## Standard workflow

1. Confirm target repository and branch strategy (`main` direct vs MR flow).
2. Read current files before modifying anything.
3. Apply focused changes with clear commit messages describing intent.
4. Prefer branch + merge request for shared/team-visible repositories.
5. Verify results (changed files, commit SHA, remote branch/MR link).

## Guardrails

- Never force-push unless explicitly requested.
- Never rewrite shared history by default.
- Preserve existing unrelated changes in the repo.
- Avoid committing secrets or tokens in tracked files.
- Ask for confirmation before destructive operations (delete/rename at scale).

## Repository conventions for this project

- Keep mirrored assets under `cursor-skills/`.
- Keep original folder hierarchy when syncing sources.
- Treat `SKILL.md` as executable operational guidance and `README` as context.
- Make changes traceable and reviewable through concise commits.

## Expected outcome

Teams can programmatically and consistently use operational tools according to
our design patterns, with clear governance and cross-team standardization.
