[![English](https://img.shields.io/badge/English-current-2f81f7)](./README.md) [![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-switch-d0d7de)](./README.zh.md)

# Nerd Mode for DeepSeek Harness

A study switch and two study skills for dsh. `/study` guides one concept or one task and writes nothing. `/study-plus` runs a recorded session against a dated learner model. The switch makes teaching the default posture of any conversation, in any mode.

## Requirements

- DeepSeek Harness with a profile.
- Node.js 22.19 or newer.
- Windows, macOS, or Linux.

## Install

From npm:

```powershell
dsh plugin --profile <profile> add dsh-nerd-mode
```

From GitHub:

```powershell
dsh plugin --profile <profile> add github:bocchii-the-code/dsh-nerd-mode
```

From a local folder or tarball:

```powershell
dsh plugin --profile <profile> add C:\path\to\dsh-nerd-mode
```

Restart dsh. Every mode gains the `/study-mode` command and a `Nerd mode` switch in the session header. The mode picker gains no new entry: the plugin mounts at profile level, not as a preset.

## Usage

Two skills, two sizes. Both teach one thing at a time and both stop to ask. They differ in what they keep.

### Quick lesson: `/study`

**What it does.** Walks one concept or one task from the first step to the last, and stops once at the point where the route changes the result. For a concept it explains in layers: intuition, terms, formal detail. For a task it produces the artifact and writes one line of reason beside each step. It reads no file and writes no file, so it works in any folder and leaves nothing behind.

**When to use it.** A question you want to understand now and will probably not return to.

- Reading a paper and a term stops you.
- A homework problem you have to finish tonight.
- A file whose logic you need to follow before you change it.
- A small decision where you want the trade-off spelled out before you pick.

**How to use it.**

```text
/study why does Adam divide by 1 - beta^t
/study walk me through the preconditioner in this file        # with code
/study help me finish problem 3, and explain each step        # with homework
```

Type the command, or turn the switch on and just ask. With the switch on, a learning-shaped request gets this shape by default.

**What you get.** A title, the central idea, numbered steps, a symbol table when the symbols get dense, one worked example, the common mistake, and one stop at the fork. For a task, the finished artifact with its reasoning.

**What it does not do.** No file appears. Nothing is scored. Nothing is remembered after the conversation ends.

### Long lesson: `/study-plus`

**What it does.** Builds a concept graph for one topic, then teaches one concept per session against a record of what you have already demonstrated. The record is four markdown files in the workspace. The lesson reads them at the start of every session, writes them at the end, and dates every claim about what you know.

**When to use it.** A subject you will still be learning next month.

- You are working through a textbook, a course, or a paper properly.
- You need to know what to study next, not just what to ask now.
- You want evidence of progress, not an impression of it.
- You keep looking things up and forgetting them.

**How to use it.** First session, later sessions, and the target.

```text
/study-plus Shampoo and Adam optimizers              # first session builds the graph
/study-plus                                           # later sessions continue the topic
/study-plus I want to reach the matrix square root    # set a target
```

First session: it proposes 15 to 30 concepts with prerequisite links and waits. You approve or edit one row, then name what you already know well enough to skip. Then it teaches one concept in five steps: recall one earlier concept cold, teach to completion, three unseen questions, a teach-back, and a dated record.

Later sessions read the four files first, so the first line names the next concept, the reason, and the date of the evidence behind it.

**What you get.** A concept order, one concept taught to completion, a graded check, and a record that survives restarts.

**What it does not do.** It does not schedule reviews, and it does not guess that you know something. Only an answer you produced changes the record.

### What each one leaves behind

| | `/study`, quick lesson | `/study-plus`, long lesson |
|---|---|---|
| Writes files | none | `study/<topic>/`: `graph.md`, `state.md`, `log.md`, `plan.md` |
| Reads files | none | those four, before the first line |
| Remembered next session | no | yes, with dates |
| Graded | no | pass and miss, rubric written first |
| Typical span | one sitting, one idea | 15 to 30 concepts over weeks |

If a `study/` folder appears in your workspace, that was `/study-plus`. `/study` never creates one.

### Which one

- A question you will not return to: `/study`.
- A subject you will return to for weeks: `/study-plus`.
- Started with `/study` and keep coming back? Move up. Build the graph once, and the earlier conversation still informs it.

An example. You are reading the Shampoo paper and hit the preconditioner. `/study what does the Shampoo preconditioner actually do` settles it in one sitting. If you decide to read the paper properly over a month, open `/study-plus Shampoo and Adam optimizers` and let it order the concepts first.

### Commands

```text
/study-mode on          teaching posture for this conversation
/study-mode off
/study <concept or task>
/study-plus <topic>     recorded session with the four study files
```

The switch in the session header sends `/study-mode`. It stays visible in both states, dim when off.

## What the switch does

- It changes text, not tools. The tool set and the prompt cache stay stable.
- It applies to learning-shaped requests only: explain a concept, tutor homework, walk through code, prepare for an exam. A feature request, a search, a config edit, or a command runs as usual.
- It is per conversation. The state lives in the session log, so compaction and resume keep it.
- Subagents run their own session, so each starts with the switch off.
- It cannot delete a base mode's persona text. It outranks that text by declaration.

## Skills included

- `study`: the guide. No file, no grade.
- `study-plus`: the recorded session. Five steps, concept graph, evidence log.
- `diagram`: one SVG figure per idea. Written for this package.
- `answer-me-with-html`: one-page HTML explainers, by QingYunA.
- `teach`: a dated teaching workspace, by Matt Pocock.
- `writing-beats`: beat-by-beat article structure, by Matt Pocock.
- `humanizer`: rewrite AI-sounding prose, by Siqi Chen.
- `convert-documents-to-markdown`: Word, PDF, and ebook conversion, by firecrawl.

## Notes

- The plugin loads its own `skills/` folder from `cordis.patch.yml` with a `!!js` expression. Review patch changes as host-process code.
- If you rename the package, update the `resolve('dsh-nerd-mode/package.json')` string in `cordis.patch.yml`.
- Bundled third-party skills keep their own licenses. See [NOTICE.md](./NOTICE.md).
- Design notes: [SPEC.md](./SPEC.md), [GLOSSARY.md](./GLOSSARY.md), `docs/adr/`.
- Tested with `@deepseek-ai/dsh` 0.2.1-rc.3 on Node 22.

## Uninstall

```powershell
dsh plugin --profile <profile> remove dsh-nerd-mode
```

## License

MIT. Bundled skills keep their own licenses; see [NOTICE.md](./NOTICE.md).
