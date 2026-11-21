# Shared preparation header and role table

Status: resolved
Blocked by: none

## Goal

Every dispatch prompt starts with one header block, and role files resolve from the skill base directory rather than the workspace.

## Answer

Done in `d5e2f87`, on the integration branch. `skills/study-plus/SKILL.md` gains section 9:

- The six-role table: role, when it runs, what it writes, what it returns.
- The base-directory rule: `${CLAUDE_SKILL_DIR}` resolves from the host's base-directory line, and a role file never resolves from the workspace.
- The header block, written as one quotable block: role, no learner contact, no nested agents, no tracker files, no invented paths, no overwrite of a draft or dated lecture, text fallback when writes are unavailable, and the four-line report shape.

## Acceptance

- The block names all seven constraints and the report shape.
- The base-directory rule follows the `answer-me-with-html` pattern.
- No rule in the block belongs to a single role.
