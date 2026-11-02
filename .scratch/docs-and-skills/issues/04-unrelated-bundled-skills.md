# Four bundled skills unrelated to teaching

Type: grilling
Status: resolved
Blocked by:

## Question

The package ships seven skills. Three serve study: `study`, `study-plus`, `diagram`. Four do not: `humanizer`, `writing-beats`, `convert-documents-to-markdown`, `answer-me-with-html`. Do the four stay, and how does the package describe and govern them?

Evidence:

- `package.json` publishes the whole `skills` directory, so all seven install together.
- The README's "Skills included" list gives each one a line. It never says which ones serve a study session.
- Only `diagram` is loaded by the teaching skills. `study` and `study-plus` both name it for figures. Nothing loads the other four.
- All seven are model-invocable. None sets `disable-model-invocation`; `teach` was the only explicit-only skill, and it left in 0.4.4.
- `answer-me-with-html` instructs the model to use it "proactively and liberally, without being asked". Inside a lecture that can replace chat output with an HTML page, which contradicts `study`'s default.
- Unpacked weight: `answer-me-with-html` 970 KB of 1.25 MB total, `humanizer` 67 KB, `writing-beats` 5 KB, `convert-documents-to-markdown` 1.9 KB. The tarball is 407 KB.

## Answer

All seven skills stay, and no skill changes behaviour this round. The READMEs now show the boundary.

- **Shape.** The "Skills included" section splits in both languages. `### Teaching` holds `study`, `study-plus`, and `diagram`. `### General tools` holds the four, under one sentence: they ship with the package but sit outside the teaching flow and never read or write a Tracker.
- **Rejected: changing frontmatter.** Making the four explicit-only would remove the conflict at the source, but it also removes the automatic use that makes them worth shipping. The user chose documentation over a behaviour change.
- **Rejected: splitting the package.** The four would have to move to their own distribution, with README, NOTICE, and release changes.
- **Known risk, recorded not fixed.** `answer-me-with-html` still tells the model to use it "proactively and liberally, without being asked". A lecture can still be replaced by an HTML page. The docs name the boundary, and nothing enforces it.

Verification: 109 tests pass after the README edits. No code, frontmatter, or package file changed.

