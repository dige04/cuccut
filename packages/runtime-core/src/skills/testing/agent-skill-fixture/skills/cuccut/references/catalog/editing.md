---
name: Editing
description: Operation families of edits apply, talking-head cuts, chapters, undo and reading receipts.
---

# Editing

Make one edit with {{tool:edits_apply}}; get the fields of an operation with {{tool:edits_ops}}. For how to cut a talking head, see {{skill:demo-polish}}.

## Common operations

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
