# Figure

Draw one SVG for each figure request a draft batch returns. The request sets the content. The `diagram` skill sets the form.

## Inputs

- One block per figure, with four fields: `Figure`, the name; `Shows`, one sentence on the relation; `Data`, exact values or `none`; `After`, the section the figure supports.
- The Course's `diagrams/` root: `study/<course>/diagrams/`.
- The Chapter each request belongs to.

## Do

- Load the `diagram` skill for the visual authoring rules. Use the study path below, not its generic default.
- Name the file from the request's `Figure` value: one lowercase kebab-case path segment, no slashes, no dot segments. Write it at `study/<course>/diagrams/<name>.svg`.
- Compute every plotted point with the shell: `pwsh` on Windows, `bash` on macOS or Linux. Read the result back and put those exact values in the SVG. Never place a point by eye, and never round a value the request gives.
- Write `Data: none` as a diagram with no plotted values. Draw the relation the `Shows` line names.
- Before replacing an SVG of the same name, copy the old file to `<name>.svg.bak`, replacing any older backup.
- Before writing, confirm the resolved parent stays inside the Course's `diagrams/` root. Write only an `.svg` target there.
- Make the figure agree with its request. When the request is ambiguous, draw the narrowest relation its `Shows` line supports and say so in `Judge`.

## Do not

- Write outside the Course's `diagrams/`.
- Draw a request with no `Shows` line.
- Add a figure nobody requested, or a second figure for one request.
- Put lecture prose in the SVG. One caption sentence, or the labels the figure needs.
- Change a value that the request gives.

## Report

Start with the header lines, then add these below `Judge`, one per item:

- `Skipped: <figure name> - <reason>` for every request you did not draw, or `Skipped: none`.
- `Rewrite: <figure name> - <what the draft must change>` when the request cannot agree with the draft.
