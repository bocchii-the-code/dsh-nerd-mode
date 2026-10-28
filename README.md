<p align="center">
  <img src="assets/nerd.svg" width="280" alt="A hand-drawn nerd with thick glasses and two buck teeth">
</p>

<h1 align="center">Nerd Mode for DeepSeek Harness</h1>

<hr>

<p align="center"><em>One concept at a time, with a record that outlives the chat.</em></p>

<p align="center">
  <a href="./README.zh.md"><img src="https://img.shields.io/badge/%E4%B8%AD%E6%96%87-switch-d0d7de" alt="中文"></a>
</p>

Learning in a chat usually ends when the answer arrives: nothing is checked, and nothing survives the conversation. Nerd Mode changes what dsh does with a question. It teaches in steps, it stops where the choice matters, and it can keep a dated record, so a subject lasts weeks instead of one sitting.

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

Restart dsh. Every mode gains the `/nerd-mode` command and a `Nerd Mode` pill in the composer bar. The mode picker gains no new entry: the plugin mounts at profile level, not as a preset.

## Usage

Two skills, two sizes. Both teach in steps and both stop to ask. They differ in what they keep.

### Quick lesson: `/study`

**What it does.** Walks one concept or one task from the first step to the last, and stops once at the fork: the point where the choice changes the result. For a concept it explains in layers, from intuition to terms to formal detail. For a task it produces the artifact and writes one line of reason beside each step. It keeps no learner record and grades nothing. It saves a lecture or artifact only when you name a path, and it may draw an SVG figure when a picture helps. It is also the single source for the lecture-writing rules that `/study-plus` follows.

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

An explicit `/study-plus` goes straight to tracked study, even when the request names several concepts. An explicit `/study`, or a request that arrives through Nerd Mode without a command, asks one question when it names two or more independent concepts: a one-off book-style answer in chat, or a tracked `/study-plus` session. The one-off answer uses a title, chapter headings, and section headings in plain Markdown.

**What you get.** A title, the central idea, numbered steps, and a symbol table when the symbols get dense. One worked example, the common mistake, and the single stop at the fork. For a task, the finished artifact with its reasoning.

**What it does not do.** It does not score, keep a learner record, or continue a topic across sessions. It saves a lecture or other requested artifact only when you ask, and then at the path you name.

### Long lesson: `/study-plus`

**What it does.** Organizes one topic as a Book of Chapters and Sections. Each Section holds one concept. It builds a concept graph in prerequisite order, groups the concepts into Chapters, and teaches and assesses one concept per Concept cycle. The graph also carries Chapter and Section columns, so one file records the reading order beside the prerequisite order. It keeps three tracker files and saves one Markdown file per concept under `study/<slug>/lectures/`. After you approve the graph it prepares a complete draft for every concept, so a lesson starts without waiting. It builds an HTML book from the saved material and refreshes that page whenever the material changes.

**When to use it.** A subject you will still be learning next month.

- You are working through a textbook, a course, or a paper properly.
- You want the textbook's chapters to organize what you reread.
- You want to know what to study next, and a chat only answers what you ask.
- You want evidence of progress, not an impression of it.
- You keep looking things up and forgetting them.

**How to use it.** First session, later sessions, and your choice of what to study.

An explicit `/study-plus` starts tracked study directly. It does not ask the one-off book question, even when the topic covers several concepts.

```text
/study-plus Shampoo and Adam optimizers              # first session builds the graph
/study-plus                                          # later sessions continue the topic
/study-plus chapter 2                                # read that chapter in Book order
/study-plus the matrix square root                   # jump straight to one concept
```

First session: it proposes 15 to 30 concepts in prerequisite order and groups them into Chapters. It shows the chapter list and the concept table together and waits. You approve, edit, or rebuild. After that, you name what you already know well enough to skip. It then writes one complete draft per concept, including the concepts you skipped, so no later lesson waits on preparation. Drafts count as preparation, not learning. It follows the `/study` writing standard before it teaches. Then it teaches one concept in five steps: an optional Recall Session, teach to completion, the configured number of unseen questions, a teach-back, and a dated record. The lecture is saved before it is shown.

An older graph opens with a migration preview. Nothing is rewritten until you confirm. A concept the graph removes has its lecture file moved to `lectures/archive/`, not deleted.

Later sessions read the tracker files first. You pick a Chapter or a Concept, and it names that Concept, its state, and the state of its prerequisites in one line. Nothing forces a prerequisite order.

**Profile defaults.** Settings -> Nerd Mode stores this profile's defaults for tracked sessions: whether each session opens with a Recall Session, and how many unseen questions follow a lecture, in which form (short answer, four-option multiple choice, or mixed). Save applies to the next session; Cancel discards a draft; Restore defaults returns to recall off, 3, short answer. An explicit preference inside one `/study-plus` request wins for that session only.

**What you get.** A reading order and a prerequisite order, any concept you choose, a graded check for that concept, a saved lecture, and a record that survives restarts. An HTML book refreshes after each draft batch and each lesson, with one page per saved Section in its original order, full text search, and a draft label on unprepared reading.

**What it does not do.** It schedules no reviews and never guesses that you know something. Only an answer you produced changes the record. It never blocks a concept because a prerequisite is open. It explains or recommends the prerequisite, and the choice stays yours.

### What each one leaves behind

| | `/study`, quick lesson | `/study-plus`, long lesson |
|---|---|---|
| Writes files | saves a lecture or artifact at the path you name, and an SVG when a picture helps | `study/<topic>/`: `graph.md`, `state.md`, `log.md`, one file per concept, `book.html` refreshed automatically |
| Reads files | no reads by default, but reads or writes a requested artifact path | the three tracker files, before the first line |
| Remembered next session | no | yes, with dates |
| Graded | no | each concept, rubric written first |
| Organized as | one concept, one task, or a one-off book | Book, Chapter, Section |
| Typical span | one sitting, one idea | 15 to 30 concepts over weeks |

`/study` does not create a `study/` folder by itself. A saved lecture or artifact goes where you name it, including a path under `study/<topic>/lectures/`. A figure goes to `diagrams/<topic>/` unless you name another path. It must not read or write `graph.md`, `state.md`, `log.md`, or `plan.md`.

### Which one

- A question you will not return to: `/study`.
- A subject you will return to for weeks: `/study-plus`.
- A textbook whose chapters should shape the reading order: `/study-plus`, which mirrors them as Chapters.
- Started with `/study` and keep coming back? Move up. Build the graph once, and the earlier conversation still informs it.

An example. You are reading the Shampoo paper and hit the preconditioner. `/study what does the Shampoo preconditioner actually do` settles it in one sitting. If you decide to read the paper properly over a month, open `/study-plus Shampoo and Adam optimizers` and let it order the concepts first.

### Commands

```text
/nerd-mode on           teaching posture for this conversation
/nerd-mode off
/study <concept or task>
/study-plus <topic>     recorded session with the three tracker files
```

The book page is not a command. `/study-plus` refreshes it after each draft batch and each lesson, and keeps the previous copy as `book.html.bak`.

The pill in the composer bar sends `/nerd-mode`. It sits left of Full Throttle, stays visible in both states, and goes dim when off.

## What the switch does

- It changes text, not tools. The tool set and the prompt cache stay stable.
- Teaching applies to learning-shaped requests only: explain a concept, tutor homework, walk through code, prepare for an exam. A feature request, a search, a config edit, or a command runs as usual.
- The switch is per conversation. Its state lives in the session log, so compaction and resume keep it.
- If the command fails, a toast at the top of the window names the reason, and the pill keeps its state.
- Subagents run their own session, so each starts with the switch off.
- It cannot delete a base mode's persona text. It outranks that text by declaration.

## Skills included

- `study`: the no-grading guide and the lecture-writing standard. Saves a requested file and draws figures when useful.
- `study-plus`: the recorded session. Book, Chapters, Sections, one lecture per concept, assessment per concept.
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
- Design notes: [SPEC v3](./docs/specs/2026-10-28-study-plus-v3.md), [v2, historical](./docs/specs/2026-10-27-study-plus-v2.md), [session defaults spec](./docs/specs/2026-10-28-nerd-mode-settings.md), [GLOSSARY.md](./GLOSSARY.md), `docs/adr/`. Doc layout: [docs/README.md](./docs/README.md).
- Tested with `@deepseek-ai/dsh` 0.2.1-rc.3 on Node 22.

## Uninstall

```powershell
dsh plugin --profile <profile> remove dsh-nerd-mode
```

## License

MIT. Bundled skills keep their own licenses. See [NOTICE.md](./NOTICE.md).
