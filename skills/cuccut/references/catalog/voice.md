---
description: Voice mechanics - translated dubbing, voice-over and speech synthesis, voices; separating instructions from lines, target and mixed languages, the limits of tags, duration and complete reading. Read before dubbing or synthesizing speech.
---

# Voice: translated dubbing, voice-over and voices

## When to use

- Dubbing a video into another language (translated dubbing).
- A voice-over or a passage read aloud is wanted, placed in the video or delivered as an audio file.
- Choosing a voice, or seeing which voices are in the user library.

## Preflight

- {{tool:models_capabilities}} (capability `synthesizeSpeech`): whether speech synthesis is available, the languages each model supports (`languages`), voices, speed range, the per-request text limit (`maxInputChars`), and whether delivery instructions are accepted (`acceptsInstructions`). Voice IDs and supported languages are whatever the current model returns; the per-model voice reference pages (see the table below) can help with casting but do not replace the availability query.
- Dubbing needs a translation: first write the translation (kind `translation`) via the translate-yourself path in [subtitles](subtitles.md), then dub.
- Voices in the user library: {{tool:library_list}} with {{arg:library}} `voices`; details with {{tool:library_show}}. Cloned voices need authorization, which the user does in CucCut.
- Separating voices from the background needs the local separation capability (capability `separateAudio`); without it, dubbing reports `DUB_SEPARATION_NOT_CONFIGURED`.

| Current TTS model | Read when choosing a voice |
| --- | --- |
| Gemini TTS | [Gemini TTS voice reference](voice-gemini-tts.md) |
| Other models | Read that model's own voice notes and go by the voice IDs the capability query actually returns; do not apply the Gemini voice table |

## Commands and examples

### Translated dubbing

{{tool:dub}}: synthesizes sentence by sentence, aligns to the original sentence timings and places the result on a new dubbing track.

| What to do | Key parameters |
| --- | --- |
| Dub from the translation you wrote (default) | {{arg:video}} + {{arg:translation}} (the translation's documentId) |
| Choose a voice | {{arg:voice}}: the model's voice ID, or `library:<id>` from the user library |
| How to treat the original audio | {{arg:original}}: `duck` lower it (default), `mute` silence it, `keep` keep it |
| Keep the background and treat only the voice | {{arg:separateBackground}} |
| Choose the service and model | {{arg:provider}}, {{arg:model}} |

Giving only {{arg:to}} without {{arg:translation}} has the configured text model translate first: use it only when the user explicitly wants that. By default, translate yourself first.

### Voice-over and speech synthesis

{{tool:speak}}: {{arg:text}} is what to say; optionally {{arg:voice}}, {{arg:language}}, {{arg:instructions}}, {{arg:format}}, {{arg:seed}}; {{arg:speed}} is accepted only by models whose `speedRange` is not null (see "Multi-sentence narration" below).

- With {{arg:video}}: when done, the audio is imported as that video's **candidate asset** (the result has an `assetId`) and is not placed on the timeline; when you use it, place it with `addItem` in {{tool:edits_apply}}.
- Without video: you get only an artifact (`artifactId`). To put it into a video, pass {{arg:artifactId}} to {{tool:assets_import}} (no regeneration); when the user wants the file itself, use {{tool:artifacts_save}}.
- Text longer than `maxInputChars` is refused at submission (`INPUT_TOO_LONG`, with the limit): split it by sentence or paragraph yourself and submit piece by piece; the Runtime does not truncate for you.

### How to fill in delivery instructions and lines

{{tool:speak}}'s {{arg:instructions}} and {{arg:text}} are two different things passed as separate parameters; do not join "instructions: line" into one text. A colon is not a CucCut instruction-separator protocol:

- **{{arg:instructions}} says only how to speak**: target language, the accent wanted, tone, setting and role ("Speak in English, calm and natural, like a late-night radio host"). Describing the performance through a concrete situation is clearer than piling up emotion adjectives; do not include the content of the lines, and do not use it to guarantee a physical duration.
- **{{arg:text}} says only what to say**: by default, only the words to be read aloud, without stage directions, bracketed notes or tone markers; for model-specific local actions, see the exceptions below.
- The two point the same way: tense instructions go with tense lines; instructions saying "relaxed" over bad news will come out awkward. When the user asks for a verbatim read, keep the original script and adjust the instructions; do not alter the lines to create emotion.
- Do not over-specify the instructions; naming the tone and setting is enough, and the model fills in the rest naturally.
- Do not use real brands or real people as style references ("like such-and-such host").
- The same character uses the same voice and the same baseline instructions throughout; when synthesizing in pieces, every piece carries the same instructions.
- Choose the language of {{arg:instructions}} from the model's notes or results of earlier test reads: use English when the model explicitly asks for it or works better with English instructions; with no evidence of a preference, use the user's language. The language of the instructions and the language of the reading are decided separately; when switching to English instructions, still state the target language clearly, and keep text as the original script in the target language rather than translating it along with the instructions.
- Only models with `acceptsInstructions` accept instructions; when not accepted, omit instructions, choose the voice and speed from the capabilities, and do not stuff the instructions into text.

| Scene | instructions (when the model accepts them) | text |
| --- | --- | --- |
| Late-night narration | Speak in English, calm and warm, like a late-night radio host telling a story | It's late. The lights outside are still on. |
| Japanese with English terms | Explain in Japanese, keep the English pronunciation of English terms, natural and clear | この機能は workflow を自動化します。 |
| Soft reminder | Speak in Spanish, softly, as if afraid to wake someone sleeping | Creo que por fin se ha dormido. |
| English instructions, Mandarin lines (when the model works better with English instructions) | Speak in Mandarin Chinese with a warm, conversational tone. | 欢迎回来，我们接着往下讲。 |
| Amused reaction | Speak in English; first laugh naturally, as if hearing something unexpectedly funny, then speak with a smile | Haha, I never saw that coming! |
| Tired sigh | Speak in English; first sigh softly, as if finally sitting down after a busy day, then speak | Ahh... finally done. |
| Slow reassurance | Speak in English, slowly and gently, like calming an anxious friend | Don't worry, we'll take it one step at a time. |

The laugh and sigh examples are only for lines where creative changes are allowed; "Haha" and "Ahh" are text that may be read aloud, not action tags. Do not add interjections to a fixed script; where the model supports it, request the performance through the instructions alone. Whether a natural laugh or breath comes out has to be checked by listening; do not treat these words as syntax that is guaranteed to produce non-speech sounds.

### Language, local actions and dialogue

{{tool:speak}}'s {{arg:text}} must be written directly in the target language; when translation is needed, translate first rather than relying on {{arg:language}} or the instructions to make the synthesis model translate on the fly. The target language is decided by the user's request and the task context, not inferred from the language of the instructions. Pass language as a BCP 47 code the current model supports; it is not a translation switch, and it cannot guarantee an accent on its own.

- For mixed languages, keep the actual text of each language to be read in text, and when the model accepts instructions, spell out the switching and how terms are pronounced; a single language cannot express a list of languages. When the model does not explicitly support mixed reading, first try a representative short sentence; if it cannot read it correctly, explain the limitation rather than translating it into a single language on your own.
- Put global emotion in instructions; for pauses, prefer the target language's punctuation. `[sigh]`, `[laughing]`, `[whispering]`, `[long pause]` and SSML are not general CucCut syntax, and `acceptsInstructions` does not mean these tags are supported. Only when the current model explicitly supports them and a test read confirms it, add the necessary local actions to the synthesis text; captions and the body keep the pure lines.
- Do not stuff emotion words such as `[scared]` or `[excitedly]` into the lines, and do not promise that bracketed content will not be read aloud. When the model does not support tags, write the overall intent into the instructions; handle pauses or non-speech sounds that must be precise with silence and separate sound effects on the timeline, and do not claim tags control milliseconds precisely.
- speak currently picks only one voice per call and has no parameter for assigning voices by role. Synthesize dialogue role by role, turn by turn, keeping each role's voice and instructions the same, then arrange by the actual durations returned; do not treat "Joe: … / Jane: …" as an instruction to switch speakers automatically, and do not put role names into the text to be read unless the names are meant to be read aloud.

### Duration and complete reading

- **No duration constraint**: prioritize reading the original script completely and accurately; do not cut words, speed up or generate extra calibration audio to fit a speech-rate table.
- **With a duration constraint**: duration depends on the model, language, voice, content and performance, and a prompt cannot guarantee an exact number of seconds. When there is no sample audio yet, use the [narration speech-rate reference table](voice-language-rates.md) to estimate a first-draft budget by language, unit and rate; for a narrated video, revise it by measuring with the target configuration following {{skill:narration}}. Translated dubbing still follows the dub alignment flow above.
- When it runs over, first decide whether the lines may be rewritten; a fixed script must not be skipped, truncated or rewritten on your own to fit the duration; explain the conflict between the script and the duration to the user. After synthesis, go by the media duration returned.

### Multi-sentence narration: chunking, voice and speech rate

- **The engine chunks**: a local model can only read a dozen or so seconds reliably at once, so long text is split inside the engine at sentence-ending punctuation into chunks of about 60 units (one CJK character or one English word counts as one), synthesized chunk by chunk, then joined after evening out the pauses and loudness between chunks. Chunks are generated independently: the engine evens out pauses and loudness at chunk boundaries, but **not the timbre**. Preset speakers whose `voices[].source` is `model` are sampled independently per chunk, and pitch drifts 3–5 semitones between chunks, so it sounds like a different person.
- **For multi-sentence narration choose a voice that holds its timbre**: an authorized cloned voice from the user library (`library:<id>`) or a built-in voice whose `source` is `builtin`; every chunk is generated against the same reference recording, and pitch differs by less than 1 semitone between chunks. Use preset speakers only for 60 units or less, or when the user names one, stating the risk.
- **Submit the whole passage at once**, or a few hundred characters/words per paragraph; do not submit sentence by sentence: it does not make the voice more consistent, and instead lengthens the total duration and slows each unit. Submit a single sentence on its own only when re-voicing that sentence (same voice, same instructions, a different {{arg:seed}}).
- **{{arg:speed}} is not a universal knob**: only models whose `speedRange` in {{tool:models_capabilities}} is not null accept it; models where it is null refuse it (`MODEL_UNSUPPORTED`). `speedRange` and `acceptsInstructions` indicate the numeric speed and style-instruction capabilities respectively; do not infer one from the other.
- **Keep performance pace and the duration budget separate**: when the model accepts instructions and responds to them, you can write performance requests such as "slow and soothing" or "fast and excited"; when the model explicitly does not support it or a test read shows no effect, work within its limits. Do not ask the prompt to deliver "five characters per second" or "exactly thirty seconds", and do not squeeze an overlong script into the budget by temporarily speeding up the performance or changing speed on the timeline; settle the performance first, then write the script to the measured rate, and measure again if the performance changes.
- **{{arg:seed}} is the re-voicing knob**: when the model accepts seed, fix one and note it; when one sentence is unsatisfactory, change only that sentence's seed and leave the satisfactory ones alone.
- To measure speech rate and pauses: {{tool:transcribe}} the narration asset (asserting the language, with proper names in the hint) to get word timings, and compute units per second and inter-sentence pauses per sentence. The full method is in {{skill:narration}}.

## Reading the results

- {{tool:dub}} completed: `pipeline.summary.trackId` is the dubbing track, and `summary.units` says how many sentences were placed, how many were not synthesized, and why. Report sentences that were not synthesized to the user.
- {{tool:speak}} completed: `outputs` has the `artifactId` and media facts (duration); with video, also `assetId`.

## Common error codes

| Error code | Next step |
| --- | --- |
| `CAPABILITY_NOT_CONFIGURED` | No usable speech synthesis: pass it on to the user following `next`, or install a local model bundle per [models](models.md) |
| `DUB_SEPARATION_NOT_CONFIGURED` | Background separation is unavailable: pass it on to the user, or ask whether it can be done without separation ({{tool:dub}} without {{arg:separateBackground}}) |
| `VOICE_CONSENT_REQUIRED`, `VOICE_CLONE_REQUIRED` | The user library voice lacks authorization or has not been cloned on this service yet: pass it on to the user to handle in CucCut |
| `INPUT_TOO_LONG` | Text too long: split by sentence and submit piece by piece |
| `GRANT_REQUIRED` | The user must authorize sending the text to an online service: pass `remedy` on to the user |

## Next steps

- The dubbing track is placed: export the finished video or just the audio ({{tool:export}}; {{arg:source}} can take only the dubbing or only the original audio, see [export](export.md)).
- Music is wanted, or music needs to sit under the voices: see [music](music.md) (where music comes from, generation, `setDucking` ducking).

## Acceptance

- Every sentence is dubbed, or those not dubbed have a reason and are reported.
- No lines are skipped or altered; the target language and the proper names and terms in mixed languages are correct, and instructions, role labels and action markers were not read into the result. Without listening, these cannot be recorded as passed.
- The same character's voice is consistent; the dubbing does not bury important original audio in the picture (the original audio is treated as the user confirmed).
- Tone, alignment and volume **need a human to listen**: export a short segment for the user to hear, and state truthfully in the report if nobody listened.
- Multi-sentence narration: each sentence's units per second and inter-sentence pauses are **measured** (computed from word timings following {{skill:narration}}); whether it sounds like the same person across chunk boundaries **needs a human to listen**.
