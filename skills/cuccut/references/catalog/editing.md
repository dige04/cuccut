---
description: Timeline editing mechanics - the transaction and revision of one edit, dry runs, looking up operations on demand, examples of common operations, talking-head cut proposals and cuts, chapters, undo and reading receipts. Read before changing the timeline for the first time.
---

# Editing: changes on the timeline

## When to use

- Editing: placing assets, trimming, splitting, moving, deleting, ripple deleting, changing speed, transitions.
- Talking-head cuts: removing filler words and long pauses, cutting flubbed takes (cuts).
- Chapters, text and elements, picture placement and appearance, effects, sound and ducking, canvas size.
- Writing documents (transcripts, translations) is also an edit, but usually goes through {{tool:documents_put}} (see [subtitles](subtitles.md)); the author's chapters are written into the video with {{tool:chapters_adopt}} (see "Chapters" below).

Where to cut, which lines to keep and how long pauses should be are the crafts' business: {{skill:talking-head-cut}}, {{skill:video-chapters}}, {{skill:shorts-segments}}. This page covers only how to submit and how to read receipts.

## Preflight

- {{tool:videos_inspect}} to get the current revision (`revision`) and object IDs (tracks, items, assets, documents). With many items, read a span with {{arg:fromSeconds}} / {{arg:toSeconds}}.
- Tell the two clocks apart: moving, trimming, splitting, ripple deletes and chapters use **timeline seconds**; cuts (`addCuts`) use **the asset's own seconds**. For the conversion see "Time" in [conventions](../conventions.md).
- Locked items and tracks cannot be changed; ask the user before touching them.

## Commands and examples

### One edit: {{tool:edits_apply}}

- {{arg:operations}} is an array of operations executed in order; **it commits only if all succeed**: if any step fails, the whole edit has no effect and the video is unchanged.
- {{arg:expectedRevision}} carries the revision from {{tool:videos_inspect}} or the previous receipt; a mismatch is refused (`PROJECT_REVISION_CONFLICT`).
- {{arg:label}} is a short description shown in history and undo (for example "Remove the small talk at the start").
- Put related steps in the same edit: when the user says "not that batch", one undo takes it all back. Later operations in the same edit can refer with `ref` to an asset imported by an earlier `importAsset`.
- Write times as seconds (`1.5`), or as `{"unit":"frames","value":30}`.

### Dry run first

When you are not sure an operation is written correctly or how much it will affect, first submit {{tool:edits_apply}} once with {{arg:dryRun}}: shape, parameters, referenced objects and files, and revision mismatches report the same errors as a real submission; when it passes, it returns the completed operations and their impact (`committed: false`), the video is unchanged and nothing enters history. Overlaps on the same track, locks and job protection are only known on a real submission.

### Looking up operations on demand: {{tool:edits_ops}}

Do not memorize the list of operations, and do not pull all of them at once. Look up only the operation you are going to use: pass {{arg:op}} to {{tool:edits_ops}} (e.g. `removeRange`), which returns its description, the JSON Schema of its parameters and an example.
<!-- surface: cli -->
The same content is also available via `cuccut spec edits.<operation>`.
<!-- /surface -->

Operation families at a glance (always look up the fields on demand):

| Family | Operations | What they do |
| --- | --- | --- |
| Assets | `importAsset`, `collectAssets` | Register assets (linked, or copied into the video); pull linked assets into the video |
| Items | `addItem`, `moveItem`, `moveItems`, `trimItem`, `splitItem`, `joinItems`, `deleteItems`, `updateItem` | Place on the timeline, move, trim, split, join, delete (leaving a gap), rename and enable, follow policy |
| Ripple | `removeRange` | Delete a span of time and shift what follows earlier; list the dubbing and caption tracks that must move with it |
| Picture | `setTransform`, `setStyle`, `setEffects`, `setSpeed` | Position and size, fill or picture-in-picture, crop and appearance, color and effects, constant speed change |
| Text | `setText` | Change a text item's text or turn it into a timer readout |
| Sound | `setAudioMix`, `setDucking`, `removeDucking` | Volume, mute, fade in and out; lower the music when voices come in |
| Transitions | `setTransition`, `removeTransition` | Transitions between items or on one side |
| Chapters | `setChapters`, `upsertChapter`, `removeChapter` | Replace chapters wholesale or change them one by one |
| Cuts | `proposeCuts`, `acceptCutSuggestions`, `addCuts`, `restoreCut` | Generate a cut proposal for filler words and pauses, accept suggestions, cut directly, restore |
| Tracks and canvas | `addTrack`, `updateTrack`, `updateSequence` | Add tracks, lock and hide, canvas size and background color |
| Documents and history | `putDocument`, `createCheckpoint`, `renameVideo` | Write documents, leave checkpoints, rename the video |

Common operations (generated from the catalog):

<!-- generated: common-ops -->
**Import an asset** (`importAsset`): registers a media file as an asset of the video.

```json
{"type":"importAsset","path":"demo.mp4","ref":"clip"}
```

**Place an asset** (`addItem`): places an asset on the timeline; without at it is appended to the end of the track, and without trackId it goes on the first unlocked track of the matching kind (video and images on a visual track, audio on an audio track).

```json
{"type":"addItem","asset":{"ref":"clip"},"at":1}
```

**Trim** (`trimItem`): trims the start or end of an item; at is the new timeline position of that edge.

```json
{"type":"trimItem","itemId":"item_1","edge":"end","at":8}
```

**Move** (`moveItem`): moves an item; at is the new start time, offset a relative move (may be negative); give one or the other.

```json
{"type":"moveItem","itemId":"item_1","at":5}
```

**Delete** (`deleteItems`): deletes items (other items do not move; a gap is left).

```json
{"type":"deleteItems","itemIds":["item_1"]}
```

**Split** (`splitItem`): splits an item in two at this timeline position; keyframes are divided by the window of each half, and when trimming, keyframes stay with the content.

```json
{"type":"splitItem","itemId":"item_1","at":3.5}
```

**Change volume** (`setAudioMix`): changes the sound of an audio, video or audible composition item; volume is a linear multiplier from 0 to 4, 1 being the original volume (0.5 is about -6 dB, 2 about +6 dB); a fade of 0 removes it.

```json
{"type":"setAudioMix","itemId":"item_1","volume":0.5,"fadeOut":1}
```

**Change text** (`setText`): changes the text of a text item, or turns it into a timer readout; give exactly one of the two.

```json
{"type":"setText","itemId":"item_1","text":"Chapter 1"}
```

Caption layers are created with {{tool:captions_create}}, not with an operation here; to cut a span and close the gap, use `removeRange`, and for cuts in a talking head use `addCuts`. Get the other operations and how to write each field from {{tool:edits_ops}}.
<!-- /generated -->

### How talking-head cuts work

1. `proposeCuts` (with an asset ID, choosing filler words, pauses and the target pause length in `detect`) generates a cut proposal: a document of kind `editorial-proposal`, which does not change the timeline.
2. Read the proposal with {{tool:documents_read}}: each entry of `suggestions` has `id`, `kind` (filler or pause), a source range, `text` and `reason`.
3. `acceptCutSuggestions` accepts only those that should go; to change a range, use `addCuts` directly (in the asset's own seconds) and put the suggestion ID in `ref`.
4. The proposal does not detect sentences said twice: cut flubbed retakes yourself with `addCuts`, using the transcript's word timings.
5. Cuts can be restored with `restoreCut`; the cut set is a document of kind `cut-set`.

If the transcript changed after the proposal was made, accepting fails (`details.rule` is `proposal-stale`): run `proposeCuts` again.

### Chapters

- **Chapters you split yourself**: `setChapters` replaces the whole chapter list (strictly increasing in time; the first chapter is usually at 0); to change just one chapter, use `upsertChapter`. How to split them is in {{skill:video-chapters}}.
- **The author's chapters or an outline the user pasted**: {{tool:chapters_adopt}}; do not align times by hand. With {{arg:video}} (optionally {{arg:asset}}, {{arg:document}}) it takes the asset's author chapters (`assets[].source.chapters`); with {{arg:outline}} (`[{ at, title }]` or the raw outline text) it uses the user's outline. It snaps each entry to the nearest paragraph or sentence start in the transcript (falling back in turn to paragraph, sentence, caption, word), cleans up titles and writes them with `setChapters`; {{arg:dryRun}} only shows the result without writing. The receipt's `sourceChapters` gives `entries`, `matched`, `ambiguous` (several starts nearby; the one closest to the author's time was taken), `snapped`, `unanchored` (no match; original time kept) and per-entry `rows`; tell the user about those that did not match. `NO_SOURCE_CHAPTERS`: there are no author chapters, so split them yourself following {{skill:video-chapters}}; `ASSET_NOT_PLACED`: the asset is not on the timeline.

Chapters are pinned to moments on the timeline and do not move with items: after moving or deleting items or ripple deleting, check them again. Talking-head cuts are the exception: `addCuts`, `acceptCutSuggestions` and `restoreCut` make chapters follow the content (chapters after a cut span shift earlier, chapters cut entirely are removed; on restore, those after the seam shift later).

### Deriving child videos

{{tool:videos_derive}} builds a span of the parent video into an editable child video next to it (method in {{skill:shorts-segments}}). {{arg:hook}}, {{arg:reason}} and {{arg:notes}} are written into the child video's derivation document (notes: at most 80 characters each, at most 8 entries); the result echoes back the `hook`, `reason` and `notes` recorded in the document, omitting any that are absent. When an existing child video is claimed again (`reused` true), the document is not rewritten, and the echo is the original one, not what you passed this time. To read it again, read the result's `derivationDocumentId` with {{tool:documents_read}}.

To frame shot by shot, pass {{arg:crops}}: each span's `from` and `to` are seconds on the parent's edited timeline (use the `shots` from {{tool:videos_shots}} directly), plus that span's crop on all four sides. The main asset's items are split where the framing changes, each carrying its own crop; the result's `framing` is the spans actually used after snapping to frames and clipping to the range, `crops-adjusted` means some spans were clipped or dropped, and `animation-split` means a split item had a looping animation or volume envelope, now counted from the start in each span. Parts before and after the range keep the framing of the first and last span: when restoring the words at the start or end, the restored picture follows that span, which is wrong if that stretch belongs to another shot; mention this in the note.

### Undo and history

- {{tool:edits_undo}}: undoes your own most recent edit; you can also pass {{arg:transactionId}} to pick one. An undo is itself a new edit and returns the same kind of receipt.
- {{tool:videos_history}}: lists history (who changed it, the resulting revision, whether it can be undone) and checkpoints.
- If you got it wrong, undo your own step; do not reverse it by hand, and do not undo the user's edits for them.

## Reading the results

The receipt is the only truth: only what is in the receipt was actually changed.

- `revision`: the new revision; pass it with the next edit.
- `transactionId`: this edit; used for undo.
- IDs of created, changed and deleted objects: take new items' `itemId` from here.
- Change in duration: report it to the user after a talking-head cut.
- `timeResolution`: which frame times actually snapped to.
- Attached notes: `removedTransitions` (transitions removed because they no longer hold), `removedByCuts` (items lying entirely within cut ranges), `shortenedTransitions`, `orphanedAnchors` and so on; when they appear, explain them to the user.

## Common error codes

| Error code | Next step |
| --- | --- |
| `PROJECT_REVISION_CONFLICT` | The video was just changed: run {{tool:videos_inspect}} again and decide from the new state |
| `TARGET_LOCKED` | The item or track is locked: ask the user whether to unlock it; do not unlock it yourself |
| `TRANSITION_HANDLES_INSUFFICIENT` | Not enough media on either side of the cut point: `details` gives how many frames are missing; shorten the item or the transition |
| `INVALID_ARGUMENTS` | The operation is written wrong: look up this operation's schema with {{tool:edits_ops}} and fix it |
| `ASSET_MISSING` | The linked asset file is gone: ask the user to put it back or give its new location |

## Next steps

- After cutting, the transcript's timeline view changes and translations go stale: go to [subtitles](subtitles.md) and retranslate only the changed sentences.
- To see the picture: go to [media](media.md) to grab frames.
- Files are wanted: go to [export](export.md).

## Acceptance

- Read back: {{tool:videos_inspect}} for items and duration, {{tool:documents_read}} for the cut set or chapters, and check item by item against the plan: what should go is gone, what should stay is still there.
- Cut points fall between words and breaths are kept; whether pauses flow needs a human to listen: export a short segment for the user to hear, and state in the report which things were only measured.
- After moving items, re-read text, zoom-ins and B-roll on other tracks to check their positions.
