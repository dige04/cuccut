---
name: translate-subtitles
description: Use when the user wants a video's transcript or subtitles translated, bilingual subtitles, or a stale translation updated - translate sentence by sentence into the video's translation document, then caption and export as needed. With media, translate means subtitles. Not for text unrelated to video.
version: 2.0.0
---

# Translating subtitles

Viewers read subtitles while the speaker is still talking: a line is narrow, stays two or three seconds, and is replaced once read. So the deliverable is subtitles, not prose. You write each sentence's whole translation; when it goes on the picture (captions_create), CucCut matches each translated sentence to the timing of its source sentence, then splits it into cues by width. Sentence boundaries must correspond one to one with the source, the word order within a sentence should let each split segment roughly match what is being said at that moment, and the wording must be short enough to read in two or three seconds.

The easiest way to get it wrong: translating it like a good essay. Merging two sentences into one, splitting one into two, moving the second half to the front for flow, turning speech into written prose, making every sentence a notch longer than the source. Such a translation reads well on its own, but on the picture it no longer matches the audio, and the subtitle changes while viewers are halfway through reading it.

It can also be used when the user explicitly wants only a subtitle file translated and there is no video; see the last section, "When the user explicitly wants only a subtitle file".

## 1. Confirm first

- **Target language**: a BCP 47 tag (such as `zh-Hans`, `en`, `ja`). When the user did not say what to translate into, ask once. The source language is the transcript document's language.
- **Which transcript**: the document of kind speech among those videos_inspect lists; when there are several, match the one the user means by its source asset (sourceAssetId), and ask if it does not match.
- **Whether the transcript is polished**: when it is not (typos, terms and punctuation are still as recognized), polish it first following `polish-transcript`, then translate. Polishing changes the sentence splits and sentence fingerprints: polish and write back first, then read the sentences to translate; after a video with an existing translation is polished, most sentences need retranslating. Translating before polishing means doing it twice.
- **Existing translation**: when a translation (kind translation) already exists in the same target language with sourceDocumentId pointing to this transcript, edit it (same documentId) rather than creating a second one; create a new one only when the user explicitly wants a separate one.

## 2. Read it through and settle the approach

Read the transcript with documents_read, with translateTo set to the target language: from this CucCut shows "translating" on the video card and in the captions panel, which ends when a translation in that language is written. The translationBasis it carries gives the sentences already split. Before writing, read the whole text and settle these things; apply them throughout the translation. They do not go into the deliverable:

- **Content summary**: one or two sentences on what this video is about. Misheard words and vague references are judged by it.
- **Terms**: identify the terms in the source (the transcript may misspell them; watch for several misspellings of the same term), and use only one translation for each term throughout.
- **Proper names**: keep names of people, products and organizations, consistent throughout.
- **The user's glossary**: translations the user names are hard requirements and are used verbatim: no inflection, no spelling change, no added or removed spaces, not translated, not omitted; what the user only says "preferably translate as" is a preference: keep it consistent, but it may give way to context. Each term has only one translation.
- **The user's requirements**: explicit requirements such as tone and style have the highest priority, but do not violate the term translations the user named, nor the deliverable rules below.

## 3. Sentence-by-sentence rules

- Translate each sentence once: no merging, splitting, omitting or reordering, and do not move a sentence into another paragraph. Neighboring sentences are only for understanding the context.
- Understand the whole sentence first, then translate faithfully and naturally in the target language's own idiomatic word order. Later timing maps the natural whole sentence onto time; do not write stilted sentences just to follow the source's clause order.
- Among equally natural translations, choose the one whose clause order **follows the source** (the way simultaneous interpreters work): subtitle lines are timed to the source speech, and a translation that unfolds in the same order as the source yields lines that each match the meaning being heard. Reorder only when the target language really requires it.
- Length is part of correctness, not a matter of style: a translation with the same meaning and fewer words is the better translation. First drop spoken filler, redundant connectives, repeated subjects and lead-ins; of two equally faithful phrasings, choose the shorter.
- Length always comes after meaning. Do not cut necessary meaning, negation, qualifiers, numbers, names, tone or register to make it shorter: if the sentence really needs that length, use it.
- Keep every explicit relation of cause, contrast, condition and consequence (because, but, if, so and the like) and the content they govern, even if it makes the sentence longer. Line splitting can break up a complete translation, but it cannot restore an omitted clause.
- Give only **one** translation per sentence: no slash-separated or bracketed alternatives. Slashes appear only in terms copied verbatim (such as a command like `/compact`, whether it comes from the source or the user's glossary).
- Terms are consistent throughout.
- Follow the target language's own spacing conventions: no spaces between characters in Chinese and Japanese; Korean is spaced by word, with particles and counters attached to the preceding word or number.
- Add no line breaks or paragraph markers within a sentence; output only the translation itself, with no notes, quotes or source text.

A comparison (English to Chinese, illustrative only):

Source: `So what we ended up doing, and this took us a while to figure out, was to let the model review first.`

Bad: `我们花了好一阵子才想明白，最后决定让模型先审一遍。` (moves the second half to the front: when viewers hear "what we ended up doing", the subtitle shows "花了好一阵子" - "took us a while")

Good: `我们最后的做法，花了好一阵子才想明白，就是让模型先审一遍。` (unfolds in the source's order, so once split into two or three lines, every line matches what is being said at the time)

### Extra rules when the target is Simplified Chinese

These are fixed requirements and take priority over the style you settled on:

- Use idiomatic Simplified Chinese; do not copy the source word order when it reads like translationese.
- Use Chinese punctuation. No space between two Chinese characters, and no spaces inside identifiers.
- Always put one half-width space between a Chinese character and adjacent Latin letters: Latin words, identifiers, model names, and command-line flags together with their leading dashes. Write `35% KV 缓存` and `通过 --speculative-model 指定`, not `35%KV缓存` and `通过--speculative-model指定`. Arabic numerals or percentages next to a Latin word also get one space. This is a hard requirement.
- Write ellipses as `……`, collapse runs of repeated question or exclamation marks into one, and do not add thousands separators to ordinary four-digit numbers.
- Keep code, identifiers, URLs, model names, product names and the user's named term translations verbatim: the identifier's own characters are untouched, and next to Chinese characters it still gets that one space.

## 4. Write back to the video

- Write the complete translation with documents_put, as documents_read's documentation describes: when creating, give kind `translation`, language set to the target language and sourceDocument set to the transcript's documentId; when updating an existing translation, give document. One unit per sentence, with sourceBasis set to the translationBasis read this time, and each unit's alignment info (which source sentence and which words it corresponds to) filled in as documented, without omitting anything or inventing fields. Write the whole translation in one documents_put.
- **Retranslate only the sentences that changed** (after the transcript was edited or cut, or the user says the translation is stale): documents_read the transcript again (also with translateTo) to get the latest translationBasis, then read the existing translation. Units whose sentence id and fingerprint both match are kept as they are; mismatched and new sentences are translated again; sentences no longer in the transcript are not written. Replace sourceBasis with the new one. After writing back, the Runtime updates the changed sentences in caption layers built from this translation; do not build another layer. Redo everything only when the user asks for a full retranslation: retranslating unchanged sentences only makes the translation the user has already read and edited change again.
- When the transcript is edited again before writing (a version conflict, or what you read is no longer the current version), read again and follow the new sentences.

## 5. Delivery

- Explain: the target language; how many sentences were translated (when only retranslating, how many were kept and how many retranslated); which terms were applied; which sentences you are unsure of, and why.
- Put it on the picture: build a caption layer with captions_create. For bilingual, give the translation document with `bilingual: true`; for translation only, give the translation document. Each call on the same document adds another layer, so first check with videos_inspect whether one has already been built.
- When the user wants a subtitle file, use export (kind `subtitles`): for bilingual, `bilingual: true` (the primary document is the transcript, the secondary the translation, one cue per sentence); for translation only, give language, which requires a caption layer in that language already on the picture (captions_create first); set the line width with maxCharsPerLine. Wait with jobs_inspect until completed and tell the user the path in outputs.

## 6. What to avoid

- Do not merge, split or omit sentences, and do not move the second half of a sentence to the front.
- Do not turn speech into written prose for flow, and do not make every sentence longer than the source.
- Do not cut negation, qualifiers, numbers, names, or cause and contrast just to be shorter.
- Do not give alternative translations, add line breaks within a sentence, or include notes or the source text.
- Do not translate before polishing; do not create a second translation when one exists; do not retranslate the whole thing when sentences are unchanged.

## 7. Self-check

- Every sentence is translated, with no merged, split, omitted or extra sentences.
- Terms and proper names are consistent throughout; the user's named translations appear verbatim in the corresponding sentences.
- Negation, numbers, qualifiers, and cause and contrast are all there; no meaning was cut to be shorter.
- Pick a few long sentences at random and imagine them split into two or three lines: does each line match what is being said at that moment?
- No alternative translations, no line breaks within sentences, no notes.
- Spacing and punctuation conventions of the target language are right; for Simplified Chinese, the spacing between Chinese and Latin text is right.

## 8. When the user explicitly wants only a subtitle file

This is the exception: do this only when the user explicitly says they want only a subtitle file and no video or project; otherwise translate in the video as above.

- From a link: transcribe with url and `noVideo: true` (or download without video, newVideo and project, with `transcribe: true`), which only downloads and produces TXT and SRT transcripts in the downloads directory. For a local media file, use transcribe with file and `noVideo: true`. When jobs_inspect reaches completed, their paths are in outputs; read them directly, and if you cannot, save them into the working directory with artifacts_save and read them there. When the user gives a ready-made subtitle file, read it directly.
- The target language (section 1), reading through and settling the approach (section 2) and the sentence-by-sentence rules (section 3) still apply; this path has no transcript in a video to polish, so translate the source's recognition errors correctly from context.
- Translate each cue once, keeping the sequence numbers and timecodes, without merging or splitting cues.
- When a sentence spans several cues, understand it as a whole sentence, then by the "follow the source order" rule make each cue's translation correspond to what is said within that cue's time.
- Write it as a new file in the working directory, with the target language tag added after the original name (such as `<original name>.<target language>.srt`), then put it in the downloads directory with downloads_save and tell the user the path it returns.
