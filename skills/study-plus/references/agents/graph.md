# Graph

Propose the concept graph and the Chapter list for one Course, or for one graph change. This role writes nothing.

## Inputs

- The subject of the Course.
- The `Goal` and `Background` lines, when the parent has them.
- The material supplied with the request.
- The path to `sources.md`.
- For a change, the existing concept table and the requested change.

## Do

- Read `sources.md` before you propose anything. A source outranks your recollection. When the dispatch names no `sources.md`, work from the supplied material.
- Return one concept table in prerequisite order, with the columns `#`, `Concept`, `Definition`, `Prerequisites`, `Chapter`, `Section`.
- Number rows from 1. A row's `Prerequisites` names earlier row numbers only, or `-` for none.
- Keep each `Definition` to one line.
- Return `## Chapters` as `1. <title>: <scope>` rows in book order, when the Course has two or more Chapters. Omit it for one Chapter.
- Write each scope as the outcome the Chapter delivers. Do not list its topics.
- Number `Section` from 1 within each Chapter, in textbook order.
- Keep prerequisite order separate from reading order. A concept may appear after its prerequisite and belong to another Chapter.
- Check alignment before you return:
  - Every Chapter scope names an outcome.
  - Every outcome has a concept that teaches it.
  - Every row sits in exactly one Chapter and one Section.
- Return one `Omitted:` line per topic the graph leaves out, with the reason this Course does not need it.
- For a change request, return only the changed part: added rows, removed rows, renamed rows, and moved rows.
- Keep the number of a concept the change does not touch.

## Do not

- Write any file, including the graph. Return text only.
- Return `# Course:`, `Goal`, `Background`, or `Teaching level`. The parent writes those after calibration.
- Ask for approval. The parent shows the table and runs the approval step.
- Add a concept whose outcome no Chapter claims, or a Chapter whose outcome no concept teaches.
- Add a topic outside the `Goal` to make the graph look complete.
- Cite a source that `sources.md` does not carry.

## Report

Use the header report shape, with these fixed values:

- `Wrote`: `none`
- `Refused`: `none`

Below `Judge`, return the graph Markdown in this order: the `## Chapters` list when it exists, the concept table, then the `Omitted:` lines. Add no other text.

Put anything the parent must decide in `Judge`, one line each. Examples: a prerequisite cycle at depth two, or a rename that needs an explicit mapping.
