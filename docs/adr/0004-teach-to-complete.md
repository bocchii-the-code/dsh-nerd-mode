# Teach to complete, and compute every plotted point

The Teach step used to stop when the idea was usable. It now stops when the concept is complete, by the tutor's judgment, with no length cap and one message per lecture. A usable idea is enough to answer a question. A lecture is what the learner rereads, so it has to hold on its own.

Length is the cost. A concept with a derivation can run past two screens. Splitting it would break the argument at a section break, so the learner scrolls instead.

Figures forced a second decision. A function plot is only honest if its points are computed, and this preset had no calculator. `tool-pwsh` is now enabled for figure geometry and nothing else. That widens the attack surface: the preset fetches web pages, and a page can try to steer a command. The persona confines the tool to computing points and writing SVG, and files stay inside `study/<slug>/`.

The prose rule comes from one source. `writing-beats` is loaded once per session so the lecture is built in beats, each term grounded before a beat leans on it.
