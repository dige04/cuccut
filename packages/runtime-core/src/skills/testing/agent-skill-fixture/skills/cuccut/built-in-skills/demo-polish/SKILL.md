---
name: Demo polish
description: A craft for tests - polish a transcript. Only for the renderer and sync script tests.
version: 1.0.0
---

# Polish a transcript

Before writing, use `skills_read` to read this skill's `references/notes.md`: the base text and defaults are there.

1. Read the transcript with documents_read and confirm sourceBasis.
2. Edit word for word and write back to the same document with documents_put; afterwards check the revision with videos_inspect.
3. At delivery, put the notes in the downloads directory with downloads_save.
4. Hand chapters to {{skill:demo-chapters}}; that step uses setChapters of {{tool:edits_apply}}.
