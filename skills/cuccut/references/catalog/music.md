---
description: Music mechanics - where the music comes from, how to submit local music generation, how to write a style description, how to fill long videos, how to duck the music under voices once it is on the music track, licensing and listening. Read before scoring a video or when a piece of music is wanted.
---

# Music: music generation and the music track

## When to use

- Adding background music to a video: the same for talking-head cuts, narrated videos and videos made from scratch.
- A piece of instrumental music or a song is wanted, delivered as an audio file.
- Existing music needs replacing, a volume change, or ducking under voices.

For reading a passage aloud or dubbing, see [voice](voice.md). CucCut has no sound effect generation; whether simple cue sounds are synthesized in code is decided by the craft of the task at hand.

## Preflight

**First decide where the music comes from**, taking the first row that holds, from top to bottom:

| Situation | What to do |
| --- | --- |
| The user did not ask for music, and the task's plan does not call for it | Do not add any; for talking-head cuts and narrated videos you can mention at delivery that it could be added |
| The user gave music (a local file, audio in Space, an asset already in the video) | Use the user's; do not generate other music; put the source and license in the report |
| This machine can generate it (`generateMusic` in {{tool:models_capabilities}} has a usable model) | Generate instrumental music as described below |
| It cannot generate | Tell the user what needs installing and how big it is, per [models](models.md), and install only with agreement; if not installed, ask the user whether they have music, or add no music and say so at delivery |

- When the user wants music but gave none, or the plan already settled on dedicated music (such as {{skill:video-production}}), generate it directly without asking again; when the user did not ask, only suggest it, and do not spend ten-plus minutes generating on your own initiative.
- Do not look for music online, and do not use music of unknown origin or without a license.
- When the footage's own audio has music, ambience or action sounds worth keeping: keep them and layer the music on another track; lower the original audio only in the stretches where they actually clash; do not delete or replace the whole original audio.

**Capabilities and license**: {{tool:models_capabilities}} (capability `generateMusic`) shows the usable models, the per-run limit `maxDurationSec`, the default duration `defaultDurationSec`, the planning options `local.planning.options`, the character limits for style and lyrics (`maxStyleChars`, `maxLyricsChars`) and the license. The only model at present, YuE2, is CC-BY-NC-4.0, for non-commercial use only: when the user says it is for commercial use (ads, product promotion, client projects), tell the user before starting and let them decide.

**Read the video**: {{tool:videos_inspect}} to see the total duration, which tracks hold voices and narration, and which audio tracks already exist, and decide whether to score the whole video or one stretch.

**Set one set of attributes for the whole video**: genre, tempo, key and brightness, core instruments (two or three), atmosphere and space, sound quality, plus one sentence on how the mood moves (what the opening, middle and ending each feel like). {{skill:video-production}} sets these in its global definitions and music mood arc table; for other tasks, one line written from the video's content is enough.

## Commands and examples

### Generating

{{tool:music}} (a local service, with {{arg:provider}} `local` and {{arg:model}}):

- {{arg:mode}}: anything that sits under voices or narration is always `instrumental`; a song with vocals fights the person talking. Use `song` only when the user explicitly wants a song, and then {{arg:lyrics}} is required; which languages the lyrics support has not been checked one by one upstream (`lyricLanguages` is `unverified`), so tell the user first.
- {{arg:targetDurationSec}}: the length to score (for the whole video, the finished video's duration), rounded up to the next multiple of 5 seconds. It is a creative intent, not a precise guarantee.
- {{arg:maxDurationSec}}: the generation budget; leave about 20% more than the target, not exceeding the model's limit. Better too long than too short: trim the excess on the timeline and fade it out. For anything longer than the limit, see "Filling long videos" below.
- {{arg:planning}}: when not given, the model's default is used (YuE2's is `melody`); `full` is slower, use it only for long passages that need a clear arc.
- {{arg:seed}}: note it down. When unsatisfied, change the seed or the style and regenerate, changing only one thing at a time so you know which change had the effect.
- {{arg:video}}: pass it. The result is imported as that video's candidate asset and is not placed on the timeline automatically.

**Generate last.** The music's length depends on the finished video's duration: first synthesize and measure the narration and lay out the visuals, then submit once the duration is settled. One run takes from a few minutes to over ten; submit once, wait with {{tool:jobs_wait}}, and do not resubmit; it uses the GPU, so do not run it at the same time as transcription, speech synthesis or rendering the finished video.

### How to write a style description

On YuE2, the most reliable form of {{tool:music}}'s {{arg:style}} is one line of comma-separated English phrases, like the presets in CucCut's "Generate music" tool page (for example `calm solo piano, slow tempo, soft, cinematic`). Usually 5–10 phrases; `maxStyleChars` is a limit, not a length to fill. Follow this order, picking one or two from each category:

1. Genre: `ambient`, `lo-fi hip hop`, `cinematic orchestral`, `acoustic folk`, `modern electronic`
2. Tempo and groove: `slow tempo`, `around 90 BPM`, `gentle pulse`, `steady driving beat`
3. Key and brightness: `minor key`, `major key`, `warm`, `bright`
4. Mood: `calm`, `hopeful`, `reflective`, `playful`, `tense`
5. Core instruments: `soft piano, warm pads, light percussion`
6. Density: `sparse arrangement`, `minimal layers`, `full arrangement`
7. Space and sound quality: `intimate`, `wide stereo`, `clean modern mix`, `vintage tape texture`
8. Arc (optional, one phrase): `starts sparse and slowly builds, gentle resolution`

- Do not put duration or whether there are vocals into the style: duration is given by a parameter, and instrumental is decided by {{arg:mode}}.
- Do not write timestamped section scripts (`[0:00-0:12] …`) or intensity scores: the model does not follow time. When the mood must change by section, generate in segments (see below).
- Simply leave out what you do not want. Negations like `no drums` are unreliable in phrase-style descriptions and may even bring drums in; for no percussion, write `drumless` or `ambient pads only`.
- Do not use real singers, bands, song titles or brands as style references.
- When the user describes the style in another language, translate it into English phrases; keep English the user gave as-is.

Starting points by purpose, then adjust to the video:

| Purpose | Style starting point |
| --- | --- |
| Bed for narration, explainers, talking heads | `ambient, soft piano, warm pads, slow tempo, sparse arrangement, steady dynamics, understated` |
| Product introductions and launches | `modern electronic, light plucked synth, soft kick, uplifting, steady 110 BPM, clean mix` |
| Courses and knowledge sharing | `calm acoustic, soft guitar and piano, minimal, gentle, unobtrusive` |
| Stories and emotional shorts | `cinematic, piano and strings, starts intimate, builds to an emotional swell` |
| Vlogs and everyday life | `lo-fi, warm, relaxed groove, mellow keys, vinyl texture` |

Videos with people talking need sparse music with steady dynamics: no prominent lead melody, few attention-grabbing solo instruments in the same register as the voice (saxophone, distorted guitar, vocal samples), and no sudden jumps in loudness between sections.

### Filling long videos and segmenting

- **Within the limit**: generate one piece, place it on the music track, trim it at the end, and fade out over the last 2–3 seconds.
- **Longer than the limit**: loop to fill by default. Generate one piece at the limit length and repeat it end to end from the start to the end; adjacent copies overlap by 2 seconds, with a fadeOut on the earlier and a fadeIn on the later (the same track cannot overlap, so alternate the copies across two music tracks); trim the last copy at the end and fade out over 3 seconds. No speed change or stretching. This is the same as how the editor's "Generate soundtrack" fills.
- **When the mood clearly changes by section, you can generate in segments** (when there is a music mood arc table, or the two halves of a talking-head video really differ in mood): submit one segment at a time, put the seams at shot changes or pauses between sections, and likewise overlap them by 2 seconds with a crossfade. Lock genre, tempo and sound quality across segments, and by default keep the key and core instruments too (only adding or removing layers); vary mood, density and brightness per segment. Adjacent segments must connect at the seam: write where the earlier segment's arc ends up (`ends sparse, piano only`), and start the next one from that state (`starts sparse with solo piano`). The more segments, the longer the wait; tell the user roughly how long first.
- Make all seams on the timeline; do not join the files into one with ffmpeg or scripts: on the timeline the user can still change them.

### Placing on the timeline and ducking

Do it in one {{tool:edits_apply}} edit, looking up each operation's fields with {{tool:edits_ops}}:

1. If you generated with video, the result already has an `assetId`; if not, first {{tool:assets_import}} with {{arg:artifactId}}.
2. `addTrack` adds a separate audio track (such as "Music"), and `addItem` places the music on it, starting where needed (usually at the start) and trimmed at the end.
3. `setAudioMix`: set the base volume low (`volume` around 0.3, about −10 dB), a `fadeIn` of about 1 second at the start, and a `fadeOut` of 2–3 seconds at the end.
4. `setDucking`: the trigger is the track holding the voices or narration (`{"kind":"items","trackIds":[…]}`), the target is the music track, and `depth` defaults to 10 dB. The transcript-triggered `speech` does not duck yet in this version; do not use it.
5. Original audio, narration, dialogue and music each sit on their own track and layer; do not delete other tracks to make room.

## Reading the results

- {{tool:music}}: `outputs` holds one WAV's `artifactId`; with video, also `assetId`.
- Take the actual duration from the asset's media facts (the asset duration in {{tool:videos_inspect}}), not from targetDurationSec; if it is shorter than the length to score, loop or regenerate as described above; do not stretch it with a speed change.
- `warnings` contains `output-truncated`: generation reached the duration budget, and the ending may stop abruptly. On the timeline, trim at the previous phrase and fade out, or regenerate with a larger maxDurationSec (not exceeding the limit).

## Common error codes

| Error | Next step |
| --- | --- |
| `CAPABILITY_NOT_CONFIGURED`, with `remedy.action` `install-model` | The music model bundle is not installed: tell the user its size per "Music generation" in [models](models.md), and install after they agree |
| The capability reports `unsupported`, saying the audio.cpp engine cannot be found | The engine is not on this machine: handle it per the table in [models](models.md) |
| Style or lyrics too long | Trim them to within `maxStyleChars` and `maxLyricsChars` and submit again; the style should be a single line of phrases anyway |

For anything else, see "How to use the error object" in [conventions](../conventions.md).

## Next steps

- The music is on the timeline: use {{tool:export}} to export two or three preview clips (purpose preview) where voices and music overlap to listen to the balance, then export the finished video; see [export](export.md).
- Only a music file is wanted: deliver the WAV's path, or transcode to the format the user wants ([media](media.md)); do not create a video.

## Acceptance

- The music's source is in the report: given by the user (with its license), generated locally (model, style, seed, actual duration, how many segments, how it was filled), or why none was added.
- Locally generated music states the non-commercial license.
- Read back with {{tool:videos_inspect}}: the music is on its own track, extends to the end of the finished video, has fades in and out, and the ducking rule's trigger and target are correct.
- The balance of music and voices, whether seams flow, and whether the mood is right **need a human to listen**; if you cannot listen yourself, say so truthfully, and do not write "measured" as "listened".
