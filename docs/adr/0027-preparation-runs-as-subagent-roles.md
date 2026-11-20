# Preparation runs as six subagent roles

Status: accepted, 2026-11-20.

One context window carries research, graph building, drafting, figure drawing, proofreading, and the whole-Book review. As the Book grows, the later steps crowd the earlier ones and quality falls.

Preparation now runs as six roles: `study-research`, `study-graph`, `study-draft`, `study-figure`, `study-proofread`, and `study-consistency`. Each role has one file under `references/agents/`, and every dispatch starts with one shared header. The parent keeps the learner conversation and every tracker write. That includes `graph.md`, `state.md`, and `log.md`, approval, calibration, teaching, questions, teach-back, and grading.

Alternatives. Keeping preparation in one lane was rejected: one context window cannot hold the whole Book without losing quality. Registering the roles as DSH presets was rejected: the skill provider packages skills only, and preset injection from a plugin is unverified. A separate fact-checker role was rejected: proofreading already reports unsupported claims, and research already cites load-bearing ones.

Consequences. Drafts for separate Chapters run in parallel, each Course has one `sources.md`, and every figure is drawn from a written request. A host with no subagent tool runs the same steps serially and names the fallback.
