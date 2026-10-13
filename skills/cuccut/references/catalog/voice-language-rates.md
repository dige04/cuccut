---
# From the Manus tts-prompter skill
description: Speech-rate reference for first-draft narration - estimate a budget by language, region, counting unit and rate. Read when there is a duration constraint and no sample audio from the current configuration yet.
---

# Narration speech-rate reference table

## Scope and calibration conditions

Use it for a **first-draft budget** when there is a duration constraint and no sample audio from the current configuration yet; plain reading with no duration constraint does not need the table. Which languages and voices a model actually supports is still decided by the capability query; this table is not CucCut's support list.

The table below is an empirical baseline for first-draft estimates and has not been re-measured on each of CucCut's models.

- Scene: off-screen video narration, at a documentary-style, natural and steady pace.
- Calibration record: the TTS engine's default configuration, voice `Charon`, 2 samples per language; the exact engine version and per-sample details were not recorded. The voice is recorded only as a calibration condition, not as a voice recommendation.
- Prompt prefix: `Read this as a documentary narrator at a natural, steady conversational pace:`. This was the input format during calibration; CucCut still passes delivery instructions and lines in separate fields.
- `Unit`: `chars` means characters, `words` means words; `Rate` is the number of units per second of audio. Count by each row's Unit; do not convert every language to English word counts.
- Other performance styles may deviate by about ±25%, and the voice by about ±5%; these are empirical values from the calibration record, not a cross-model error bound or a duration guarantee.

## How to use it

1. Look up the row for the target language and region, and estimate the first-draft unit count as **available narration seconds × Rate**; Rate is already computed over the total audio duration, so do not subtract ordinary inter-sentence pauses again. Subtract deliberately designed long silences, intros and outros from the available time first.
2. For example, 30 seconds of Mandarin narration at `cmn-CN`'s 2.8 chars/s gives about 84 characters; 30 seconds of American English narration at `en-US`'s 2.1 words/s gives about 63 words. These are starting values for drafting, and no finished duration can be promised from them.
3. For mixed languages, count units per segment separately, and estimate time as the sum of each segment's `units / Rate`; do not add characters and words together directly. Pauses where pronunciation switches still need checking against sample audio.
4. When the language, region or a suitable counting method is not in the table, do not apply English rates; generate representative sample audio with the target model, voice, language and performance. When measurements from the same configuration exist, prefer them, and recalibrate after changing configuration.
5. After the first draft, measure and revise the budget with the speech-rate calibration method in {{skill:narration}}, and accept the result by the synthesized audio's media duration and by listening; a fixed script is not cut or altered on your own to fit the budget.

## Full reference table

The BCP-47 Code is for looking up the language; before passing it to a model, check which language codes that model accepts, and do not infer support from this table.

| Language | BCP-47 Code | Unit | Rate |
| :--- | :--- | :--- | :--- |
| Arabic (Egypt) | ar-EG | words | 1.3 |
| Bangla (Bangladesh) | bn-BD | words | 1.8 |
| Dutch (Netherlands) | nl-NL | words | 2.1 |
| English (India) | en-IN | words | 2.2 |
| English (United States) | en-US | words | 2.1 |
| French (France) | fr-FR | words | 2.2 |
| German (Germany) | de-DE | words | 2.1 |
| Hindi (India) | hi-IN | words | 2.1 |
| Indonesian (Indonesia) | id-ID | words | 1.6 |
| Italian (Italy) | it-IT | words | 1.9 |
| Japanese (Japan) | ja-JP | chars | 4.2 |
| Korean (South Korea) | ko-KR | chars | 3.8 |
| Marathi (India) | mr-IN | words | 1.6 |
| Polish (Poland) | pl-PL | words | 1.7 |
| Portuguese (Brazil) | pt-BR | words | 1.7 |
| Romanian (Romania) | ro-RO | words | 1.6 |
| Russian (Russia) | ru-RU | words | 1.5 |
| Spanish (Spain) | es-ES | words | 1.8 |
| Tamil (India) | ta-IN | words | 1.3 |
| Telugu (India) | te-IN | words | 1.3 |
| Thai (Thailand) | th-TH | chars | 7.2 |
| Turkish (Turkey) | tr-TR | words | 1.6 |
| Ukrainian (Ukraine) | uk-UA | words | 1.5 |
| Vietnamese (Vietnam) | vi-VN | words | 2.7 |
| Afrikaans (South Africa) | af-ZA | words | 2.0 |
| Albanian (Albania) | sq-AL | words | 2.1 |
| Amharic (Ethiopia) | am-ET | words | 1.2 |
| Arabic (World) | ar-001 | words | 1.3 |
| Armenian (Armenia) | hy-AM | words | 1.5 |
| Azerbaijani (Azerbaijan) | az-AZ | words | 1.6 |
| Basque (Spain) | eu-ES | words | 1.7 |
| Belarusian (Belarus) | be-BY | words | 1.5 |
| Bulgarian (Bulgaria) | bg-BG | words | 1.8 |
| Burmese (Myanmar) | my-MM | chars | 11.2 |
| Catalan (Spain) | ca-ES | words | 2.2 |
| Cebuano (Philippines) | ceb-PH | words | 1.9 |
| Chinese, Mandarin (China) | cmn-CN | chars | 2.8 |
| Chinese, Mandarin (Taiwan) | cmn-tw | chars | 2.7 |
| Croatian (Croatia) | hr-HR | words | 1.7 |
| Czech (Czech Republic) | cs-CZ | words | 1.8 |
| Danish (Denmark) | da-DK | words | 2.1 |
| English (Australia) | en-AU | words | 2.2 |
| English (United Kingdom) | en-GB | words | 2.1 |
| Estonian (Estonia) | et-EE | words | 1.6 |
| Filipino (Philippines) | fil-PH | words | 1.7 |
| Finnish (Finland) | fi-FI | words | 1.2 |
| French (Canada) | fr-CA | words | 2.2 |
| Galician (Spain) | gl-ES | words | 1.9 |
| Georgian (Georgia) | ka-GE | words | 1.4 |
| Greek (Greece) | el-GR | words | 1.6 |
| Gujarati (India) | gu-IN | words | 1.8 |
| Haitian Creole (Haiti) | ht-HT | words | 2.6 |
| Hebrew (Israel) | he-IL | words | 1.5 |
| Hungarian (Hungary) | hu-HU | words | 1.8 |
| Icelandic (Iceland) | is-IS | words | 1.4 |
| Javanese (Java) | jv-JV | words | 1.7 |
| Kannada (India) | kn-IN | words | 1.2 |
| Konkani (India) | kok-IN | words | 1.6 |
| Lao (Laos) | lo-LA | chars | 8.2 |
| Latin (Vatican City) | la-VA | words | 1.3 |
| Latvian (Latvia) | lv-LV | words | 1.4 |
| Lithuanian (Lithuania) | lt-LT | words | 1.4 |
| Luxembourgish (Luxembourg) | lb-LU | words | 2.0 |
| Macedonian (North Macedonia) | mk-MK | words | 1.7 |
| Maithili (India) | mai-IN | words | 2.1 |
| Malagasy (Madagascar) | mg-MG | words | 1.8 |
| Malay (Malaysia) | ms-MY | words | 1.6 |
| Malayalam (India) | ml-IN | words | 1.2 |
| Mongolian (Mongolia) | mn-MN | words | 1.6 |
| Nepali (Nepal) | ne-NP | words | 1.4 |
| Norwegian, Bokmål (Norway) | nb-NO | words | 1.7 |
| Norwegian, Nynorsk (Norway) | nn-NO | words | 1.6 |
| Odia (India) | or-IN | words | 1.5 |
| Pashto (Afghanistan) | ps-AF | words | 2.1 |
| Persian (Iran) | fa-IR | words | 1.5 |
| Portuguese (Portugal) | pt-PT | words | 1.6 |
| Punjabi (India) | pa-IN | words | 2.3 |
| Serbian (Serbia) | sr-RS | words | 1.7 |
| Sindhi (India) | sd-IN | words | 2.1 |
| Sinhala (Sri Lanka) | si-LK | words | 1.6 |
| Slovak (Slovakia) | sk-SK | words | 1.7 |
| Slovenian (Slovenia) | sl-SI | words | 1.6 |
| Spanish (Latin America) | es-419 | words | 1.7 |
| Spanish (Mexico) | es-MX | words | 1.8 |
| Swahili (Kenya) | sw-KE | words | 1.8 |
| Swedish (Sweden) | sv-SE | words | 1.8 |
| Urdu (Pakistan) | ur-PK | words | 2.2 |
