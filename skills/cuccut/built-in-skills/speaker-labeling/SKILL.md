---
name: speaker-labeling
description: Use when several people speak in a video and you need to tell who speaks or label speakers by name - re-transcribe with voice-based speaker separation if needed, find evidence for real names, and write them to the transcript's speakers without changing the words. Not for one speaker or proofreading.
version: 2.0.0
---

# Speaker labeling

What the user wants: a real name before every line in the transcript, captions that show who is speaking, and exported transcripts and dubbing split by person. This takes two steps: first work out how many voices there are and which line belongs to whom (diarization), then give each voice a real name (labeling). Diarization relies on a speech model, labeling on evidence; neither relies on guessing.

The easiest way to get it wrong is guessing: seeing two guests listed in the description and filling "Speaker 1" and "Speaker 2" in that order. A wrong name appears in every caption cue and every exported file, and the user often only notices much later - far worse than leaving "Speaker 1".

## 1. Check the current state first

Use videos_inspect to find this video's transcript (a document of kind speech; when there are several, match the one the user means by its source asset), then read it with documents_read:

- The body's `speakers[]` lists each speaker's id and name, and every word carries a speaker.
- **Already diarized** (two or more speakers): skip to section 3 and only label.
- **Not diarized** (only one speaker, or the words carry no speaker), but the user says more than one person is in the video: do section 2.
- When the user only wants to change names and not rerun anything, do only section 3 as well.

## 2. Diarization: re-transcribe by voiceprint

Diarization requires re-transcribing, which replaces the current transcript rather than creating another one. This step discards any words the user edited by hand in the transcript, so explain before doing it:

1. Tell the user first: re-transcribing replaces the current transcript, and any words edited by hand in it since will be lost; translations, captions and dubbing will be carried over to the new transcript. Continue only once the user agrees.
2. Use transcribe with this video, `diarize` true and `target` replace; keep this transcript's language and hint (names, terms), or use new ones if the user gave them.
3. When the model cannot diarize, the job still completes, with a `diarization-unavailable` warning on the result: tell the user this model cannot separate speakers and they need to install the "speaker diarization" model pack or switch to a model that can; do not pretend it was diarized.
4. When the user has edited the transcript since it was transcribed, the replacement is rejected with `TRANSCRIPT_EDITED`: tell the user, and only once they confirm discarding those edits, retry with `acceptEdited`.
5. After the job completes, documents_read again and see how many speakers were found and how much each said.

## 3. Labeling: name each speaker

Before acting, gather the evidence for every speaker, then settle the names together:

- **Placeholder names**: the "Speaker n" the transcription flow assigns automatically and its equivalents in other UI languages (`说话人 1`, `Sprecher 1` - "speaker + number" names of that kind), numbered labels from the recognition service (`SPEAKER_00`, `S1`, `spk-1`), and names that are empty or equal to the id. Any other name was given by the user; leave it alone.
- **Where evidence comes from**: the opening of the transcript; the lines just before and after each speaker first speaks; the source asset's title, uploader and description (videos_inspect's `assets[].source`); name captions on screen: use videos_frames to grab a few frames from the first minute or two and where each speaker first speaks. A name caption must clearly label the person who is speaking; a name that just happens to appear on screen does not count.
- **What counts as evidence**: a self-introduction ("I'm ...", "my name is ..."); an introduction by someone else ("today we have ...", "welcome, ..."); this speaker's response right after being addressed by name; a signature sign-off; source info that uniquely identifies one of them. When the metadata lists several guests but cannot tell which voice is whom, evidence from the transcript is still needed. The speaking order, speaker numbers and the topic itself do not count; conversely, when the title or description names participants, it matters even more to find evidence for each one and match names to voices.
- **How to write the name**: the form actually used in the material, usually the full name, or whatever form appears when there is no full name; keep the original script and spelling, no translation or transliteration; no titles, honorifics, organizations, brackets, quotes or explanations; at most 40 characters. When there is no name but a role is stated clearly (host, interviewer, narrator), a short role label may be used; never invent a role from the look of the conversation alone.
- **Do not guess**: when unsure, keep the placeholder name.
- **One person, several ids**: diarization may split one person into several ids, or merge two people into one. When each has its own evidence, give the ids the same name and do not merge ids; when the voices differ a lot and you are unsure whether they are the same person, ask the user first.

A comparison (illustrative only):

Bad: the description says "Guests: Alex Chen, Maria Lopez", so "Speaker 1" becomes Alex Chen and "Speaker 2" becomes Maria Lopez.

Good: at 00:12 the host says "today we have Alex Chen", and right after it "Speaker 2" answers "hi everyone", so "Speaker 2" is Alex Chen; "Speaker 1" keeps asking questions, nobody calls them by name, and the description does not say who the host is, so keep the placeholder name, or label it "Host" if the user wants.

## 4. Confirm first, then write back

1. Before writing back, show the user the plan: the name for each speaker, the evidence (one sentence), and the moment they first speak with that line, so the user can jump there in the editor and listen.
2. Once the user confirms or changes the names, write back to the same transcript with documents_put, changing only `speakers[].name`, with words and other fields exactly as read; write all speakers in one go. A version conflict means the user just edited it: read again and redo the change on the new body.
3. When only names change, translations need no retranslating, and the speakers in captions follow the transcript.

## 5. What to avoid

- Do not fill names in the order of the description's list or by who speaks first.
- Do not re-transcribe without telling the user; do not pretend speakers were separated when the model cannot do it.
- Do not add titles, organizations or brackets to names; do not translate or transliterate names.
- Do not change names the user gave; do not merge ids.
- Do not change the words of the body: only the speakers change here.

## 6. Delivery

- How many speakers were found; if re-transcribed, which transcript was replaced and what was carried over.
- Who was named and on what evidence; who has no evidence and still has a placeholder name.
- Places where diarization is wrong (the speaker changes mid-sentence, two people merged into one): list the moments and ask the user to adjust them by hand in the editor's speaker settings.
