# Ask before building

<!-- Generated from skills/_shared/ask-first.md by
scripts/inline-shared.ts — edit the fragment, never this block. -->

<!-- shared:ask-first -->
Ask only when someone can answer. CucCut has no question cards (`AskUserQuestion` calls are rejected): write the questions as plain text in your reply, list the options, in the user's language, then end the turn; otherwise (a headless run, an agent as the caller, "just do it") do what SKILL.md says: decide yourself, build, and state your assumptions in one line.

Read the material the user gave you first. A brief with two or more still-open decisions that would change the result is worth **one** message before your first write, with at most 4 questions; a brief with only one point you can default, a complete brief, or a small change gets none.

Questions come from the user's material, not from a form: point out what you read ("your notes cover four things"), its contradictions or gaps, and the decision that would most change what you make, most important first: questions only someone who read their brief could ask. Never ask what the conversation already answered; default what the context already implies and say so; boilerplate requirement-gathering questions (audience? length? UI or prototype?) are only for a genuinely blank brief.

The options are the real work: give 2–4 concrete directions for **this** piece ("Lead with the reorg", not "Narrative"), each differing along a dimension you can name, never shades of the same idea; labels are a few words that carry the choice; `description` is a few words, omitted when it adds nothing; put your preferred option first and mark it "(Recommended)", except for factual questions. Default to `"multiSelect": true`, since the person answering is often still exploring; use `false` only when the options are mutually exclusive (one length, one format). No "Other" or "You decide" options (they can always answer in their own words), and no questions that can only be answered in free text.

Treat the answers as decisions and restate them in your one-line assumptions; what they leave to you, decide and say what you chose. Ask another round (at most 4 new questions) only when they ask for more, or when an answer raises a question you could not have asked before; otherwise build. Never ask twice.
<!-- /shared:ask-first -->

## Questions to ask for a design

Ask about what the page, app or PRD the user gave you has not settled for **this** design: which of several jobs the screen does comes first, who arrives at the screen, what in their product to keep and what to break from, and which differences between artboards would help them choose. The user mentioned a product but attached nothing? Ask for it (a link, a screenshot) rather than designing blind. Nothing to align with and no visible style preference? Offer two or three concrete directions, or ask with 2–4 low-fidelity artboards. UI or prototype: decide by the signals (see SKILL.md); with no signal, pick one and say so.

For example, the user pastes a link to their app's Projects page (a dense 13px table, a "New project" button at top right, an Import from GitHub flow two tabs away in Settings) and asks for "a better empty state for teams with no projects yet". A good set of questions (this is its content; in CucCut you write it as plain text):

```json
{"questions": [
  {"question": "New project already sits top-right and Import from GitHub lives in Settings. What should the empty state push people toward?", "header": "Main path", "multiSelect": true, "options": [
    {"label": "Starter templates (Recommended)", "description": "Three cards fill the empty table"},
    {"label": "Import from GitHub", "description": "The Settings flow surfaces here"},
    {"label": "Invite teammates", "description": "An inline invite field"},
    {"label": "New project, centered", "description": "The existing button, moved center"}]},
  {"question": "The page is all-business (tight tables, no illustration anywhere in the app). What may the empty state add?", "header": "Feel", "multiSelect": true, "options": [
    {"label": "Stay in system (Recommended)", "description": "Your table's type, one line icon"},
    {"label": "One warm moment", "description": "A small illustration, only here"},
    {"label": "A sample row", "description": "A faint example project row"}]},
  {"question": "A new team hits two more empties right after this one (Members, API keys). Cover them so they read as a set?", "header": "Scope", "multiSelect": false, "options": [
    {"label": "Projects only (Recommended)", "description": "Three artboards of this screen"},
    {"label": "All three empties", "description": "One direction carried across them"}]}]}
```
