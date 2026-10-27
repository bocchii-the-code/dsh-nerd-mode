# Nerd Mode, with the command renamed and internal keys kept

The switch is called Nerd Mode in the UI, the glossary, and the README, so the slash command became `/nerd-mode`. The projection key `studyMode` and the prompt section id `study:policy` stay, because renaming them would orphan stored state and touch the host wire schema for no user-visible gain.

Consequences: session logs written before the rename hold `command/run` events named `study-mode`, which the fold now ignores, so an old conversation can reopen with the mode off. We accepted that over keeping two command names.
