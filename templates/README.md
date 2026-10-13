# templates

Built-in creative templates that ship with the app: the video templates behind the "Templates" entry on the Home start
page, loaded by the Runtime and served to the UI. One template per directory; the directory name is the template `id`.
The format and how templates are used are defined by the [template package spec](../docs/spec/template-spec.md).

Two kinds of template:

- `scene` (scene template): gives a creative direction plus a default aspect ratio and duration; once picked, the agent
  first confirms the brief with the user, then makes the video.
- `example` (example work): one complete prompt, placed in the input box when picked.

The base language of the built-in templates is English: `template.json` and `prompt.md` are written in English
(`"language": "en"`), and every other shipped language, Simplified Chinese included, is a translation under `locales/`.

## Adding a template

1. Create `templates/<id>/`; the `id` is kebab-case and must not clash with an existing directory.
2. Write `template.json` (fields in spec §3, JSON with two-space indentation) and `prompt.md` (how to write it in spec
   §2.2), in English.
3. If there is a cover, a preview video or assets, put them in `cover.*`, `preview.*` or `assets/` as in spec §2.1, and
   register them in the manifest.
4. Make one video from the template with a real agent: compress the finished video into `preview.mp4` (≤ 2 MiB) and
   `cover.jpg` (≤ 150 KiB) with the commands in spec §3.3, and write the verification record `verification` in the
   manifest (spec §3.5). Public materials used for verification are recorded only by source and license; they do not go
   into the template directory.
5. Write a translation for every shipped language other than the base: `locales/<lowercase language>.json` and `.md`
   (spec §3.6). For the format, follow `step-tutorial/locales/zh-hans.*` (scene template) and
   `ai-news-take/locales/zh-hans.*` (example work). When you change the base text, update every translation to match.
6. Run `npm test -- packages/protocol`; `template.test.ts` validates every template and translation here. To check the
   translations of a single language, use `npx vitest run packages/protocol/src/template.test.ts -t ' · ja：'`.
7. Before committing, review by hand as in spec §4.2 and §4.3: no secrets or machine paths, no real brand names or names
   of other people's works, and no language set as the default language of the finished video.
