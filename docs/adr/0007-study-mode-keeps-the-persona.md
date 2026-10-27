# Study mode keeps the tutor persona, not the tool fence

The first preset listed ten plugins and four skills. It did what a focused tutor needs: read, search, fetch, compute figure geometry, write the study files. It also refused work the learner brought. A PDF could not be converted. A one-page explainer could not be built. Research could not leave the session. A note could not go beside the topic.

The user chose the wider set. Three skills join the study root: `humanizer`, `convert-documents-to-markdown`, `answer-me-with-html`. The preset gains delegation. The shell accepts any command. Writes may go anywhere. The tutor may write a short snippet that makes a concept concrete, and a loaded skill may write the code its workflow needs. The lesson stays text plus SVG.

The persona remains the boundary. It sets the teaching shape, the grading rule, the source checks, and the study-file convention. The plugin list no longer mirrors the teaching scope, because a tool absent from the preset cannot be used even when the learner asks.

Alternatives. Keeping the narrow fence was rejected: it made the tutor refuse the learner's own material and the visuals that explain it. Mirroring General was rejected: the plugin manager, background jobs, the scheduler, and bash add risk without study use, and the scheduler contradicts ADR 0002. Loading all 126 skills was rejected: the catalog would add roughly 20k characters to every session, and coding skills would compete with the lesson.

Consequences. General shell plus web content plus any-path writes is a prompt-injection path. The persona tells the tutor to treat fetched text as data, and that rule is the only guard. Subagents run with their own instructions, so they can write anywhere and spend tokens the learner does not see. The skill catalog grows from four to seven, still small enough to scan.
