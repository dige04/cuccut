# google-fonts-catalogue

Generates the Google Fonts catalogue shipped with the Runtime, `packages/runtime-core/src/fonts/google-fonts-catalogue.json` (architecture design §9.1, “fonts downloaded on demand”). The font picker uses it to list downloadable families offline and without an API key. When downloading, the Runtime uses it to map the requested weights to the weights the family actually has. The catalogue holds metadata only, with no font files or specimens.

## Usage

Requires Node 22.18+ (runs `.ts` directly). To regenerate from the public metadata (this accesses `fonts.google.com` and GitHub's public APIs; no key needed):

```bash
node scripts/google-fonts-catalogue/generate.ts
```

You can also generate offline from two saved files, which makes the result reproducible:

```bash
node scripts/google-fonts-catalogue/generate.ts \
  --metadata /tmp/gf-metadata.json \
  --licences /tmp/gf-licence-dirs.json
```

- `--metadata`: the raw response from `https://fonts.google.com/metadata/fonts` (the leading `)]}'` may be kept or removed).
- `--licences`: `{ "ofl": [directory names…], "apache": […], "ufl": […] }`, i.e. the names of the subdirectories under the three top-level directories of the google/fonts repository.
- `--out`: write elsewhere (the default is the catalogue file above).

The script prints how many families it collected, the file size, and the families it skipped (those whose licence or category it cannot recognise). Licences are matched against the google/fonts repository's directories, and families that do not match are not collected, because the font picker must show the licence.

## Format

A JSON object. `families` is sorted by popularity, one family per line, and short keys keep the file size down:

| Key | Meaning |
| --- | --- |
| `f` | Family name (used for both download and typesetting) |
| `c` | Category: `sans-serif`, `serif`, `display`, `handwriting`, `monospace` |
| `s` | Character subsets (`latin`, `cyrillic`, `chinese-simplified`, `japanese`, `korean`…; `menu` removed) |
| `w` | Weights with an upright style |
| `i` | Weights with an italic style (omitted when none) |
| `v` | `1` for variable fonts (downloads are still static instances cut by weight) |
| `l` | Licence: `OFL-1.1`, `Apache-2.0`, `UFL-1.0` |

After regenerating, run `npm test -- packages/runtime-core/src/fonts`; the catalogue's reading and querying are covered by tests.
