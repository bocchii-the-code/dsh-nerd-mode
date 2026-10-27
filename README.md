# Study Plus for DeepSeek Harness

A study switch and two study skills for dsh. `/study` guides one concept or one task and writes nothing. `/study-plus` runs a recorded session against a dated learner model. The switch makes teaching the default posture of any conversation, in any mode.

## Requirements

- DeepSeek Harness with a profile.
- Node.js 22.19 or newer.
- Windows, macOS, or Linux.

## Install

From npm:

```powershell
dsh plugin --profile <profile> add study-plus-dsh
```

From GitHub:

```powershell
dsh plugin --profile <profile> add github:bocchii-the-code/study-plus-dsh
```

From a local folder or tarball:

```powershell
dsh plugin --profile <profile> add C:\path\to\study-plus-dsh
```

Restart dsh. Every mode gains the `/study-mode` command and a `Nerd mode` chip in the session header. The mode picker gains no new entry: the plugin mounts at profile level, not as a preset.

## Use

```text
/study-mode on          teaching posture for this conversation
/study-mode off
/study <concept or task>
/study-plus <topic>     recorded session with the four study files
```

The chip sends the same command. It stays visible in both states, dim when off.

## What the switch does

- It changes text, not tools. The tool set and the prompt cache stay stable.
- It applies to learning-shaped requests only: explain a concept, tutor homework, walk through code, prepare for an exam. A feature request, a search, a config edit, or a command runs as usual.
- It is per conversation. The state lives in the session log, so compaction, resume, and fork keep it.
- Subagents run their own session, so each starts with the switch off.
- It cannot delete a base mode's persona text. It outranks that text by declaration.

## Skills included

- `study`: the guide. No file, no grade.
- `study-plus`: the recorded session. Five steps, concept graph, evidence log.
- `teach`, `writing-beats`, `diagram`, `humanizer`, `convert-documents-to-markdown`.

`answer-me-with-html` is not included. Install it separately if you want one-page HTML explainers.

## Notes

- The plugin loads its own `skills/` folder from `cordis.patch.yml` with a `!!js` expression. Review patch changes as host-process code.
- If you rename the package, update the `resolve('study-plus-dsh/package.json')` string in `cordis.patch.yml`.
- Bundled third-party skills keep their own licenses. See [NOTICE.md](./NOTICE.md).
- Design notes: [SPEC.md](./SPEC.md), [GLOSSARY.md](./GLOSSARY.md), `docs/adr/`.
- Tested with `@deepseek-ai/dsh` 0.2.1-rc.3 on Node 22.

## Uninstall

```powershell
dsh plugin --profile <profile> remove study-plus-dsh
```
