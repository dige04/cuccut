# CucCut Template Package Specification

> Creative templates are the video production templates in the "Templates" entry of the Home starting page. They take the form of a skill: a prompt is the main content, optionally accompanied by a cover, a preview video, and images, SVG, audio and other assets. The Runtime provides the catalogue. This specification defines the template package's directory layout, manifest fields, allowed values and constraints, and how the Runtime uses templates.

Format identifier: `template.json` in the template directory, `schema: 1`.

This specification defines only the **package format and usage semantics**. For Home's interaction, see [Product Design](../product/product-design.md) §3.2.1. The manifest types and validation live in `@cuccut/protocol` (`template.ts`, `template-schemas.ts`). For terminology, see [Documentation Conventions](../README.md#conventions-for-this-document) and the [Glossary](../glossary.md).

## Contents

- [1. Scope and Conventions](#1-scope-and-conventions)
- [2. Directory and Files](#2-directory-and-files)
- [3. Manifest](#3-manifest)
- [4. Constraints](#4-constraints)
- [5. Usage Semantics](#5-usage-semantics)
- [6. Catalogue Sources and Loading](#6-directory-sources-and-loading)
- [7. Adding and Validation](#7-adding-and-validating)
- [8. Items Pending Review](#8-items-for-review)

---

## 1. Scope and Conventions

### 1.1 What a creative template is

A creative template helps users start from a creative direction: pick a template, fill in their own content, and hand it to the agent. A template provides only the prompt and display metadata. It is not part of the video, and selecting it leaves no reference in the video.

It differs from the following two things and does not share their format:

- The "template" in Product Design §5.9 [AST-04]: a native structure or code package from a video, saved as a reusable object with parameters;
- The `CreativeCatalogue` in Architecture Design §8.7: a catalogue of verified native templates and code recipes.

### 1.2 Two kinds of template

| `kind` | Name | Usage |
| --- | --- | --- |
| `scene` | Scene template | Gives a creative direction and default ratio and duration. After selection, the agent **first guides the user through a brief** and starts production only after confirming with the user (§5.2) |
| `example` | Work example | A complete prompt that can be used as is. Selecting it puts the prompt into the input box and skips the brief. The ratio and duration may be left unspecified for the agent to decide (§5.1) |

Both kinds use the same manifest format and the same category table (§3.2). They differ only in the required fields marked in §3.1 and in the usage semantics of §5.

### 1.3 Status of the types

Types are written in TypeScript and serve as a summary of the DTO. The authoritative definitions are `TemplateManifest` and `templateManifestSchema` in `@cuccut/protocol`. The two are kept consistent by compile-time checks. If this specification and the code disagree, treat it as a defect and fix both in the same task.

---

## 2. Directory and Files

### 2.1 Layout

A template is a directory, and the directory name is the template `id`:

```text
templates/<id>/
  template.json      Manifest (required)
  prompt.md          Prompt body (required)
  cover.<ext>        Cover image (optional): png, jpg, jpeg, webp, svg
  preview.<ext>      Preview video (optional): mp4, webm
  assets/            Assets distributed with the template (optional); every file is registered in the manifest's assets
  locales/           Text in other languages (optional): one <language>.json and one <language>.md per language, see §3.6
```

- The directory must not contain any file that is not registered in the manifest (translations named per §3.6 under `locales/` count as registered). Hidden files starting with `.` (for example the system-generated `.DS_Store`) are ignored on load and must not be committed.
- The cover and preview may only be placed at the directory root, with fixed file names `cover` and `preview`. Assets may only be placed under `assets/`, and may be further divided into subdirectories.
- File and directory names follow [Repository Conventions §3](../repo-conventions.md#3-naming): all lowercase, words separated by `-`.

### 2.2 `prompt.md`

The prompt body is the main part of the template. It is UTF-8 encoded Markdown, without front matter (all metadata is in the manifest). It must not be empty and must not exceed 16 KiB.

- `scene`: production requirements written for the agent, in the second person ("You are to make a video that…"). It is recommended to divide the text into short sections titled "Structure", "Visuals and Sound" and "Notes". Structure describes what each act covers. Visuals and sound describe requirements for visuals, subtitles, narration and music. Notes describe constraints on facts, permissions and language. Do not write brief guidance here, since the Runtime appends that section uniformly (§5.2). The body must not contain the placeholder `{{`: items the user is to fill in are written in the manifest's `brief` (§3.1).
- `example`: a complete request in the user's voice ("Make a video that…, you can…"). It is placed into the input box verbatim, and the user may edit it before sending. Write one to three paragraphs of continuous text, with no headings and no lists. Content that the user should decide (topic or subject, materials, product name, duration, language of the finished video, etc.) is written as a placeholder `{{label}}`, for example "narration and subtitles in {{finished video language}}". Every placeholder must be declared in the manifest's `fields` (§3.1, §5.5).
- Both kinds do not write interface parameters other than ratio and duration. Ratio and duration are written in the manifest (§5.3). The manifest values for `example` are used only for display on the card and in the details, and are not sent with the message. To have the agent work to a particular ratio or duration, write it into the body and keep it consistent with the manifest.

### 2.3 `schema` and unknown fields

- `schema` is the version of the manifest format, an integer. This version recognises only `1`. When `schema` is missing or unrecognised, the Runtime skips the template and records one diagnostic (`unsupported-schema`), without causing the whole directory to fail to load.
- Neither the top level of the manifest nor any sub-object accepts unknown fields. Misspelled fields, and fields brought in from other formats (such as quality tiers or external link addresses), are all judged non-compliant. The template is skipped and a diagnostic is recorded (`invalid`).
- Adding a field raises `schema`. The Runtime may recognise several versions at once. A version it does not recognise is skipped as described in the previous item. Additions made before the format is published (for example the verification record in §3.5, `brief`, `fields` and `skills` in §3.1, and language versions in §3.6) are still recorded as `1`.

---

## 3. Manifest

### 3.1 Fields

```ts
interface TemplateManifest {
  schema: 1;
  id: string;                 // kebab-case, ≤ 64, equal to the directory name
  version: string;            // version of the template itself, semver (1.0.0)
  kind: 'scene' | 'example';
  title: string;              // ≤ 40
  summary: string;            // one sentence shown on the card, ≤ 80
  description: string;        // a short paragraph in the details, ≤ 400
  language: string;           // language tag of the copy, BCP 47 (en)
  category: TemplateCategory; // §3.2
  ratio?: '16:9' | '9:16' | '1:1';
  durationSeconds?: number;   // integer, 5–600, multiple of 5
  brief?: string;             // the paragraph filled into the input box on selection, with {{label}} marking items to fill, ≤ 400
  fields?: TemplateField[];   // items to fill, ≤ 8 items
  skills?: string[];          // crafts suggested to read first (skills/<id>), ≤ 4 items
  author: string;             // ≤ 80
  source: 'official' | 'community';
  license: string;            // SPDX identifier, may be combined with AND / OR / WITH
  tags: string[];             // ≤ 8, each ≤ 24, no duplicates
  cover: TemplateCover;       // §3.3
  preview: TemplatePreview;   // §3.3
  assets?: TemplateAsset[];   // §3.4, ≤ 64 items
  verification?: TemplateVerification; // §3.5
}

interface TemplateField {
  label: string;              // the name inside the placeholder, ≤ 24, unique within the template, must not contain `{`, `}` or line breaks
  hint?: string;              // what to fill in, shown to the user, ≤ 80
  example?: string;           // example value, ≤ 80
}
```

| Field | Required | Rule |
| --- | --- | --- |
| `schema` | Yes | Fixed to `1` (§2.3) |
| `id` | Yes | Starts with a lowercase letter, contains lowercase letters, digits and single `-`; equals the directory name; unique within the same directory source. Not renamed after publication |
| `version` | Yes | `major.minor.patch`. Increment when the prompt or manifest content changes; a typo fix may only bump the patch number |
| `kind` | Yes | §1.2 |
| `title`, `summary`, `description` | Yes | Non-empty, no leading or trailing whitespace, not exceeding the lengths in the table above. Product voice, second person, no exclamation marks and no emoji |
| `language` | Yes | Labels only the language of the manifest copy and `prompt.md` (for other language versions see §3.6). **It is not the language of the finished video** (§4.3) |
| `category` | Yes | Taken from §3.2 |
| `ratio` | Required for `scene` | Default ratio. When omitted, it means automatic and is left to the agent |
| `durationSeconds` | Required for `scene` | Default duration (seconds): 5–600 seconds, step 5. When omitted, it means automatic |
| `brief` | Required for `scene`; must not be present for `example` | The paragraph filled into the input box when the template is selected: in the user's voice, one to three sentences, with `{{label}}` marking items to fill (§5.5), for example "Make a promotional short for {{product or service}}, aiming for viewers to {{what the audience should do}}, with {{audience}} as the target audience." Items to fill depend on the subject, usually two to five |
| `fields` | No | Declaration of items to fill, see below. For `scene`, corresponds to placeholders in `brief`; for `example`, corresponds to placeholders in `prompt.md` |
| `skills` | No | Crafts suggested to read first for this kind of finished video. Takes the `id` under `skills/cuccut/built-in-skills/` at the repository root (kebab-case, ≤ 64, no duplicates). The agent reads them with `skills_read` (§5.2). The protocol validates only the shape; every entry in a built-in template must exist under `skills/cuccut/built-in-skills/`, which is checked by the test in §7 |
| `author` | Yes | Official templates write `CucCut`; community templates write the author's public credit, without email addresses or contact details |
| `source` | Yes | `official`: distributed with the app and maintained by the repository; `community`: from the community (§6) |
| `license` | Yes | License for the template copy and bundled assets. Original built-in templates use `LicenseRef-CucCut-Community-1.0`, corresponding to the repository's [LICENSE](../../LICENSE), which allows template elements to be used in commercial works. Third-party assets keep their own licenses |
| `tags` | Yes | Search keywords; may be an empty array |
| `cover` | Yes | §3.3 |
| `preview` | Yes | §3.3 |
| `assets` | No | §3.4 |
| `verification` | No | Record of the most recent verification with a real agent, §3.5 |

Character length is counted in UTF-16 code units.

**Items to fill.** Each entry of `fields` is a `TemplateField`: `label` is the name inside the placeholder, `hint` tells the user what to fill in, and `example` is the example value. A placeholder is written as `{{label}}` (the label wrapped in double braces, with no spaces). The rules are as follows:

- Every `{{…}}` in the text must correspond to a declared `label`. Every declared entry must be referenced at least once (for `scene`, checked in `brief`; for `example`, checked in `prompt.md`). A `{{` that cannot be parsed as a placeholder is also non-compliant.
- `label` must not repeat within a template. The same `label` may appear several times in the text and refers to the same item.
- Replacing each placeholder in `brief` (for `example`, in `prompt.md`) with the item's `example`, or with its `label` where there is no `example`, gives a sample sentence of the form "you could say this". The interface shows it in the details. Therefore `example` must read naturally when inserted directly into the sentence.
- `label`, `hint` and `example` are in the same language as the rest of the copy (`language`). Items to fill in another language are written in the translation for that language (§3.6). The interface does not translate them separately.

### 3.2 Categories

Both kinds of template share one category table, classified by subject. The keys are part of the protocol: they are not renamed or reused after publication. Display names are supplied by the interface layer in the interface language. The Chinese names in the table below are illustrative.

| Key | Display name (illustrative) | What belongs here |
| --- | --- | --- |
| `marketing` | Marketing | Videos that drive action or spread the brand, such as ads, product showcases and event recaps |
| `product-launch` | Product launch | New product launches, software demos, feature updates |
| `explainer` | Explainers | Knowledge popularisation, step-by-step tutorials, technical explanations |
| `news-data` | News and data | Short news commentary, hot-topic explainers, data stories |
| `editing` | Editing | Edits based mainly on the user's existing footage: highlights from talking-head videos, vlogs, montages |
| `creative-short` | Creative short | Story shorts, cinematic scenes, trailers |
| `motion-design` | Motion design | Motion graphics, code animation, typographic motion |

A template belongs to exactly one category. Adding a category requires changing this table, `TEMPLATE_CATEGORIES` and the interface's display names together.

### 3.3 Cover and preview

```ts
interface TemplateCover {
  file?: string;    // 'cover.<ext>'
  tone?: 'blue' | 'orange' | 'green' | 'purple' | 'cyan' | 'indigo' | 'magenta' | 'seafoam' | 'brown';
  figure?: 'bars' | 'ring' | 'cards' | 'steps';
  kicker?: string;  // small text in the top-left corner of the cover, ≤ 24
}

interface TemplatePreview {
  file?: string;    // 'preview.<ext>'
  beats?: string[]; // 3–5 storyboard sentences, each ≤ 60
}
```

- When `cover.file` is set, the UI shows the cover image. When it is not set, the UI draws a placeholder cover from `tone` (background colour), `figure` (drawing style) and `kicker`, so a template without a cover image must provide `tone` and `figure`. When there is a cover image, `tone` should still be given, for use before the image loads and if it fails to load.
- When `preview.file` is set, the UI plays the preview video. When it is not set, the UI cycles a placeholder preview through `beats`, so a template without a preview video must provide `beats`. When there is a preview video, `beats` should still be given, so the detail view can list the storyboard points. `beats` is for display only and **is not concatenated into the prompt**: the template's production requirements are defined by `prompt.md`.
- The value sets of `tone` and `figure` match the UI's placeholder cover implementation. When adding a value, update both the protocol constants and the UI.
- Size limits: cover image no more than 150 KiB, preview video no more than 2 MiB (`TEMPLATE_FILE_MAX_BYTES`). The preview is a compressed illustration, not the finished film itself. Built-in templates are checked by the tests in §7, and the Runtime also checks them on load (§6); a template that exceeds the limits is judged non-compliant.
- The previews and covers of built-in templates are usually taken from the finished film made during verification (§3.5). Compress them as follows, so that the same finished film always gives the same result:

  ```sh
  # Preview: take the most representative segment of the film, no longer than 15 seconds (-ss start, -t length); longest side 640, even pixel dimensions; H.264 + yuv420p + faststart.
  # If over 2 MiB, raise crf by 2 and recompress each time (28 → 30 → 32 …); if still over, reduce the longest side to 540.
  # If the film has sound, use low-bitrate AAC: replace -an with -c:a aac -b:a 64k -ac 2.
  ffmpeg -y -ss 0 -t 15 -i film.mp4 \
    -vf "scale='if(gte(iw,ih),640,-2)':'if(gte(iw,ih),-2,640)':flags=lanczos,fps=30" \
    -c:v libx264 -preset slow -crf 28 -profile:v high -pix_fmt yuv420p -movflags +faststart -an preview.mp4

  # Cover: take one representative frame (-ss is its timestamp in the film), JPEG with longest side 640; if over 150 KiB, increase -q:v (4 → 6 → 8).
  ffmpeg -y -ss 7 -i film.mp4 -frames:v 1 \
    -vf "scale='if(gte(iw,ih),640,-2)':'if(gte(iw,ih),-2,640)':flags=lanczos" -q:v 4 cover.jpg
  ```

- When a cover image and a preview video are both present, still keep `tone`, `figure`, `kicker` and `beats` (as described in the two bullets above); the manifest allows them to coexist.

### 3.4 Assets

```ts
interface TemplateAsset {
  path: string;                                   // 'assets/...'
  type: 'image' | 'svg' | 'audio' | 'video';
  note: string;                                   // purpose of the asset, ≤ 200
}
```

| `type` | Extension |
| --- | --- |
| `image` | png, jpg, jpeg, webp, gif |
| `svg` | svg |
| `audio` | mp3, m4a, aac, wav, ogg, flac |
| `video` | mp4, webm, mov |

- Every file under `assets/` must be registered, and every registered file must exist. Paths must not be duplicated.
- `note` says what the asset is for (“end-card logo”, “background music, about 30 seconds”). It is shown to the user and passed to the agent along with the prompt (§5.4).
- Assets must be content that the template author is entitled to distribute under `license`.

### 3.5 Verification record

Before a built-in template is published, a real agent makes one video from the template. Record this run's input, conditions and result, and maintain them as part of the template:

```ts
interface TemplateVerification {
  date: string;              // verification date, YYYY-MM-DD
  version: string;           // which template version was run (semver); if the template is later changed after findings, the manifest's version will be newer than this
  engine: string;            // lowercase id of the agent engine, e.g. 'codex', ≤ 32; do not write the engine version
  input: string;             // the message sent to the agent, ≤ 4000
  materials: TemplateVerificationMaterial[]; // public materials used, ≤ 16 items, may be empty
  capabilities: TemplateVerificationCapability[]; // capabilities that were missing and therefore degraded or skipped, no duplicates, may be empty
  outcome: 'pass' | 'partial' | 'fail';
  output?: { ratio: string; durationSeconds: number }; // measured values of the finished film: width:height ratio reduced to lowest terms, and duration in seconds
  notes: string;             // problems found and changes made to the template, ≤ 1000
}

interface TemplateVerificationMaterial {
  title: string;             // ≤ 120
  url: string;               // https address of the material's page, ≤ 500
  license: string;           // e.g. CC0-1.0, Public-Domain, or the asset site's own licence name, ≤ 60
  note?: string;             // where it is used, ≤ 200
}

type TemplateVerificationCapability =
  'transcribe' | 'synthesizeSpeech' | 'generateImage' | 'generateText' | 'generateVideo' | 'generateMusic' | 'generateSoundEffect';
```

- `input`: for `scene`, write the user's message verbatim (the message that attaches this template when sent). For `example`, write “as written in the prompt”. If there are changes or additions (for example, specifying the film's language, or which capabilities the test environment lacks), state what was changed.
- `outcome`: `pass` means the finished film matches the template's aspect ratio, duration and required production requirements. If an optional part of the template (for example, “can generate a soundtrack”) was skipped because a capability was missing and the user was told, it still counts as `pass`. `partial` means a finished film was made but a required requirement was not met (for example, narration was required but no speech synthesis was done, the aspect ratio or duration does not match, or a manual extra step is needed to get a finished film). `fail` means no usable finished film was made. With `fail` there may be no `output`; the other two must give one.
- If you only update the verification record, preview and cover, the manifest's `version` does not change. If findings from verification led to changes in `prompt.md` or other manifest content, increment `version` per §3.1; `verification.version` still records the version that was run.
- `output` values are measured with ffprobe, not copied from the manifest.
- `materials` records only source and licence; the materials themselves are not distributed with the template. Use only materials whose licence explicitly allows redistribution (CC0 or public domain), because they appear in the preview.
- `transcribe`, `synthesizeSpeech`, `generateImage`, `generateText` and `generateMusic` share names with the capabilities of model services (`generateMusic` only for the local service). Video and sound-effect generation have no corresponding service yet, so their names are reserved.
- The verification record is for maintenance and display only. It is not concatenated into the prompt and does not affect the usage semantics in §5. Re-verifying replaces the whole record.

---

## 4. Constraints

### 4.1 Paths

All paths in the manifest (`cover.file`, `preview.file`, `assets[].path`) must be relative paths inside the template directory:

- Use `/` as the separator. Must not start with `/`, `~` or a drive letter (`C:`).
- Must not contain `..`, `.`, empty segments, backslashes or control characters.
- Must not be a symbolic link. After resolution on load, the path must still fall inside the template directory.

### 4.2 No keys and no machine paths

The manifest, `prompt.md` and assets must not contain API keys, tokens, passwords, personal contact details, or absolute paths from any machine. When the prompt needs an external capability, describe the capability (“use a video generation capability to make a dancing animated character”) and do not name a specific model, service or product. Do not name real brands or other people's works either; open-source technology names (for example, JavaScript or p5.js) may be kept.

### 3.6 Language versions

A template may carry copy in several UI languages. `template.json` and `prompt.md` are the original (its language is given by `language`), and translations in other languages go in `locales/`, one pair of files per language. Built-in templates use English as the original (`language` is `en`); Simplified Chinese and the other shipping languages are translations:

```text
templates/<id>/locales/
  zh-hans.json       translation of the manifest copy
  zh-hans.md         translation of prompt.md
  zh-hant.json
  zh-hant.md
  ...
```

- Languages are the app's shipping languages (`zh-Hans`, `zh-Hant`, `en`, `ja`, `ko`, `es`, `fr`, `de`, `nl`, `pt-BR`, `it`, `ru`, `pl`, `tr`, `vi`), and file names are lowercase (`pt-br.json`). Other file names are not recognised and are handled as unregistered files (§2.1).
- Files come in pairs. Do not include a translation in the same language as `language` (an `en` template must not include `en.*`; a `zh-CN` template must not include `zh-hans.*`).
- Translated JSON carries only copy, and unknown fields are always rejected. Fields not listed (`id`, `version`, `kind`, `category`, aspect ratio, duration, `skills`, cover and preview files, `verification`, etc.) are written only in the manifest and shared by all languages:

```ts
interface TemplateTranslation {
  title: string;
  summary: string;
  description: string;
  brief?: string;                    // required for scene, must not be present for example
  fields?: TemplateField[];          // count and order must match the manifest's fields one-to-one
  tags: string[];
  cover?: { kicker?: string };       // if not given, the manifest's corner label is used
  preview?: { beats?: string[] };    // same number of items as the manifest's beats
  assets?: { path: string; note: string }[];  // may only be assets registered in the manifest; if note is not given, the manifest's note is used
}
```

- Length limits are the same as the manifest (§3.1, §4.4). Placeholders are checked against the translation's own `fields` (for `scene`, check the translation's `brief`; for `example`, check the translation's `.md`). The writing rules and limits for a translated `.md` are the same as for `prompt.md` (§2.2, §4.4).
- If any one translation is non-compliant, the whole template is non-compliant (`invalid` in §6), and each diagnostic line is prefixed with the file name. When the original changes, update each translation and increment `version`.

**Choosing a language.** `templates.list`, `templates.get` and `conversations.send` may take a `language` for `template` (BCP 47). If none is given, the Runtime's UI language is used. The Runtime looks in this order: a translation in the same shipping language; another written form of the same main language (for example, Simplified when a Traditional translation is missing); English; and if none exists, the original. If during the search it reaches the original's language, it uses the original. When a translation is chosen, the manifest copy is replaced by the translation, `language` becomes that language, other fields stay unchanged, and the body is replaced by the translation's `.md`. Each list item also carries `languages`: the languages this template has, with the original's `language` first.

The catalogue is fetched according to the UI language. When fetching the prompt and sending, use the `language` of this template from the catalogue, and use the same language version in all three places. After the UI language changes, fetch the catalogue again.

### 4.3 Language neutrality

The template's copy has one language (`language`), and the language of the finished film is independent of it. Follow [development workflow §4](../development-workflow.md#4-language-and-platform):

- The manifest and `prompt.md` must not set a language as the default language of the finished film, and must not hard-code a platform for a particular language market. Describe publication destinations as “social platforms” or “video platforms”.
- When language needs to be mentioned, leave a slot. In the body of `scene`, write “the language confirmed in the brief”. In the body of `example`, write the fill-in placeholder `{{成片语言}}`. The finished film's language may be left as a fill-in placeholder rather than hard-coded. This item is not given an `example`, so that the example sentence does not make a language the default.
- Translations (§3.6) follow the same rule: translate these slots faithfully, and do not make the finished film that language just because the translation is in it.
- When the user has not specified a language, the agent decides in the order of development workflow §4: the user's explicit request, then the recorded preference, then inference from the task context. The brief guidance may include language as an item to confirm (§5.2).

### 4.4 Limits

| Item | Limit |
| --- | --- |
| `prompt.md` | 16 KiB (UTF-8) |
| `brief` | 400 |
| `fields` | 8 items; `label` 24, `hint` 80, `example` 80 |
| `skills` | 4 items, 64 each |
| `beats` | 3–5 sentences, 60 each |
| `tags` | 8, 24 each |
| `assets` | 64 items |
| Cover image | 150 KiB |
| Preview video | 2 MiB |
| `verification.materials` | 16 items |

Other copy length limits are in §3.1.

---

## 5. Usage semantics

### 5.1 Example works

When the `example` template is selected, the client puts the full text of `prompt.md` (or the translation in the chosen language, §3.6) into the input box, together with its placeholders, which are displayed as fill-in items (§5.5). After that it is an ordinary user message: the user can replace the fill-in items and change other text, and no brief guidance preamble is attached when it is sent.

### 5.2 Scene templates and brief guidance

When the `scene` template is selected, the client attaches the template to the input box (showing its title) and fills the `brief` into the input box (placeholders are displayed as fill-in items, §5.5). The user replaces the fill-in items, supplements or rewrites other text, and attaches files (optional). When sending, the client passes only the template `id` (with `version` and `language`) and the user input. The Runtime reads the body of that language version (§3.6), prepends a unified **brief guidance preamble**, and hands the result to the agent. The preamble is not written into each `prompt.md` and is not copied into the UI.

Sending uses the optional parameter `template: { id, version?, assets?, language? }` of `conversations.send` ([Command and protocol spec §4.1](command-protocol-spec.md#41-methods)):

- `text` is still the user's words in the input box: the `brief` as filled in, plus the user's replacements and rewrites; unfilled fill-in items are written as “[label]” per §5.5. It is required as usual (when the user deletes all the text and attaches only material, the client adds a sentence, the same as without a template). The user message in the conversation is `text`, carrying a template marker `template: { id, version, title, kind, origin }` (`title` is the title of the language version used). The UI shows the label “模板：标题” (Chinese UI copy, "template: title") based on this marker. The preamble, body, and asset list are passed only to the agent, not into `text`.
- The Runtime appends to `text` a `<cuccut-template id="…" version="…">` block: the template title, the preamble, the template's default aspect ratio and duration, the recommended practices to read first (`skills`, listed only if present), the `prompt.md` body, and the asset list (§5.4). The editor context and Space references are still attached after it.
- `version` is for reference only: the Runtime always uses the template currently in the catalog, and the version actually used is recorded in the template marker. A version mismatch does not raise an error.
- If the template does not exist (or failed to load), the result is `not-found` (`TEMPLATE_NOT_FOUND`). The body of an `example` template is already user input (§5.1), so attaching it and sending gives `invalid-request` (`TEMPLATE_NOT_SCENE`); the client should put the body into the input box and send it directly.
- The preamble text is a constant in the Runtime (`SCENE_BRIEF_PREAMBLE`), written in English. It requires the agent to follow the user's language when asking questions and replying, and not to switch languages because of the language of the preamble or body.

Meaning of the preamble (the Runtime implements this; the wording may be adjusted):

1. This is a scene-template task. First confirm the brief with the user. Do not start production before confirmation, and do not call tools that incur cost or modify the video.
2. The brief has four items: **topic** (what to make), **goal** (what the viewer should do or remember after watching), **audience**, and **materials at hand** (files, links, or text; none is fine). Also confirm the aspect ratio and duration: the defaults in the manifest apply, and the user may change them. Where necessary, confirm the language of the finished video (§4.3).
3. Information already given in the user message and attachments is not asked again; anything that can be read from the materials is read first.
4. Missing items are merged into one round of questions. The questions are short and offer optional defaults; there is no item-by-item back-and-forth.
5. Ask questions in the user's language.
6. Restate the organized brief to the user and wait for confirmation or changes. When the user explicitly says “直接做” (just do it), proceed with the known information and defaults, and state in the restatement which items are defaults.
7. After confirmation, produce the work following the template body. If the brief and the body conflict, the user-confirmed brief prevails.
8. If a capability required by the template body is not configured, do not stop. Without speech synthesis, use subtitles to carry narration and dialogue. For background music, use local music generation first if it is available, otherwise consider code synthesis, and skip it if that is not possible. For sound effects, consider code synthesis first, and skip them if that is not possible. Without transcription, image, or video generation, use the user's materials or code-generated visuals instead. When restating the brief and delivering the result, state which requirements were downgraded as a result, and which capability to configure to add them back.
9. Before production, read `video-production` with the cuccut tool `skills_read` (the approach from brief to finished video). If the template section lists recommended practices (`skills`), read those too.
10. Bracketed items such as “[audience]” in the user message are fill-in items the template left for the user, which the user did not fill (§5.5). Include them among the missing brief items to ask about. Do not treat them as known information, and do not copy them verbatim into the finished video.

### 5.3 Aspect ratio and duration

Home has no aspect ratio or duration settings. The agent infers the aspect ratio and duration from the user's words, and where the user says nothing, decides them from the content. The `ratio` and `durationSeconds` in the scene template manifest are defaults; the Runtime writes them into the `<cuccut-template>` block (§5.2), and anything the user states in the message takes precedence. A missing value means automatic, decided by the agent from the content. The manifest values of example works are not sent with the message (§2.2).

### 5.4 Assets

When a template has `assets`, the Runtime hands them to the agent as input readable for this task, attaching each item's `path`, `type`, and `note`. The user may remove assets they do not want before sending. Assets are not written into the video automatically; the agent decides how to use them according to the prompt.

In this version, the template section lists each asset's absolute path on this machine (files in the template directory, read-only), its `type`, and its `note`. The files are not copied into the project. When `template.assets` is given, only those entries are listed; they must be paths registered in the manifest, otherwise the result is `invalid-request` (`TEMPLATE_FILE_NOT_FOUND`). When it is an empty array, no assets are listed; when it is not given, all are listed.

### 5.5 Fill-in items

`{{label}}` in template text (§3.1) is a fill-in item for the user: in `scene` it is in `brief`, and in `example` it is in `prompt.md`.

- **In the input box**: when the client puts the text into the input box, each placeholder is displayed as a clickable replacement marker showing its `label`. Clicking it lets the user type the replacement in place. Tab / Shift+Tab move forward and backward between fill-in items; text typed into them afterward is no different from ordinary text. When the same `label` appears in several places, each is replaced independently. Text outside the markers can still be edited. Switching to a different `scene` template replaces the text in the input box (undoable), while removing the attached template leaves the text unchanged.
- **Hints and example sentences**: the template details list the fill-in items in manifest order (`label` and `hint`), and show example sentences under the heading “可以这样说” (Chinese UI copy, "you can say it like this"), formatted as described in §3.1. The hint line below the input box also lists the `label`s not yet filled.
- **Sending without filling**: when sending, the client writes unfilled items as “[label]” (with `label` inside the brackets) into `text`, without keeping `{{`. The UI notes that some items are unfilled, with the message “不填也能发送，Agent 会先问你” (Chinese UI copy, "you can send without filling; the agent will ask first"), and does not block sending.
- **How the agent treats them**: when a `scene` template is attached, preamble item 10 (§5.2) requires the agent to include “[label]” among the missing brief items it asks about. `example` gets no preamble, so “[label]” is passed as ordinary text in the message, and the agent asks follow-up questions or decides from context as usual.

---

## 6. Directory sources and loading

- **Built-in templates** (`origin: 'builtin'`): the `templates/` directory at the repository root, distributed with the app. `source` is `official` and `author` is `CucCut`. The Runtime checks, in order, the environment variable `CUCCUT_TEMPLATES_DIR`, the `templates/` directory in the packaged resources, and, in development, the repository root found by searching upward (a directory that has both `package.json` and `templates/`). If none is found, there are no built-in templates.
- **User templates** (`origin: 'user'`): `templates/` under the Runtime Home (`<CUCCUT_HOME>/templates`), which holds templates the user placed there. They follow the same format and validation as built-in templates, and `source` follows the manifest. If the directory does not exist, it is treated as empty; the Runtime does not create it on the user's behalf.
- **Community templates** [P1]: the source, download, install location, and trust rules are to be decided (§8). `source` is `community`.

When the Runtime loads a directory source:

1. It reads subdirectories one by one. Entries that are not directories, and hidden entries, are ignored. Entries that are symbolic links are not followed, and a diagnostic is recorded to explain why the template does not appear.
2. It checks `schema` per §2.3, and validates the manifest and files per §3–§4: `id` equals the directory name; `prompt.md` is non-empty UTF-8 and within the size limit; placeholders and fill-in items match (§2.2, §3.1); translations in `locales/` come in pairs and are compliant (§3.6); all registered files exist; the cover and preview are within the size limit (§3.3); there are no unregistered files; and there are no symbolic links at any level of the template directory. Non-compliant templates are skipped with a diagnostic recorded, and the rest are provided as usual.
3. If `id` is duplicated within the same source, both templates are skipped and a diagnostic is recorded.
4. If a user-directory template has the same `id` as a built-in template, the built-in one takes precedence and the user's copy is skipped with a diagnostic recorded. A template marker in a conversation references the template by `id`, so the user directory must not silently change the meaning of an official template. To change a built-in template, copy it and give the copy a new `id`.
5. The order of the list is decided by the UI; the order the Runtime returns is not a sorting contract.

Diagnostics are returned with `templates.list` as `{ code, origin, dir, path, message, issues }`. `code` is one of `unsupported-schema` (§2.3), `invalid` (the manifest, body, or files are non-compliant), `duplicate-id` (item 3), or `builtin-conflict` (item 4). `dir` is the template directory name, `path` is its absolute path, and `issues` lists the problems one by one.

The Runtime does not cache directories. Each `templates.list`, `templates.get`, and `templates.openHandle` call re-reads them, so templates the user adds or edits appear after the next listing. Attached files (`cover.file`, `preview.file`, `assets[].path`) are turned into short-lived addresses on the media channel through `templates.openHandle({ id, path })`. Only paths registered in the manifest are accepted; `prompt.md` and the manifest itself do not go through this route. For the method's parameters and return values, see [Command and protocol spec §4.1](command-protocol-spec.md#41-methods).

---

## 7. Adding and validating

To add a built-in template:

1. Create `<id>/` under `templates/`, and write `template.json` and `prompt.md` (JSON with two-space indentation);
2. If there is a cover, preview, or assets, put them in the corresponding place and register them in the manifest;
3. Use a real agent to make one video from the template. Compress the finished video into `preview.mp4` and `cover.jpg` per the method in §3.3, and write `verification` in the manifest (§3.5);
4. Run `npm test -- packages/protocol`. `template.test.ts` validates every directory under `templates/` one by one: the manifest is valid; `id` equals the directory name and is not duplicated; `prompt.md` is non-empty and within the limit; placeholders match `fields` (for `scene`, `brief` is checked in manifest validation, and `prompt.md` must not contain `{{`; for `example`, `prompt.md` is checked); `skills` includes `video-production`; registered files exist; the cover and preview are within the size limit; and there are no unregistered files. Then run `npm test -- packages/runtime-core/src/templates`, which reads everything again with the Runtime's loader (§6), requires that all templates load with no diagnostics, and checks that every item in `skills` exists in the repository-root `skills/`.
5. Write translations for every shipping language other than the original (§3.6). Built-in templates must be complete. `template.test.ts` validates each “template · language” entry one at a time (to run a single language only: `npx vitest run packages/protocol/src/template.test.ts -t ' · ja：'`). It checks that both files exist; the translation is valid and matches the manifest; each fill-in item's `hint` and `example` are present or absent consistently with the original; placeholders match. When the original's corner badges are Chinese, the translation must have corner badges. In translations other than Chinese and Japanese, no Han characters may remain.

Language neutrality of the copy, the rules against showing real brands and others' work names (§4.2, §4.3), and translation quality are not fully covered by these tests, so they need manual review before submission.

---

## 8. Items for review

- Source, download, signing, or trust rules for community templates; whether community templates are installed into the user directory (§6), and if so, whether handling of the same `id` keeps the "built-in first" rule.
- How assets are handed to the agent: this version only lists local paths (§5.4), and when the agent reads files outside the project directory it may need user approval; whether selected assets are copied into the project when sending is undecided.
- The word "template" refers to two different things in the product design §5.9〔AST-04〕 and in this specification. The glossary has no entry yet, so a name needs to be chosen to tell them apart.
