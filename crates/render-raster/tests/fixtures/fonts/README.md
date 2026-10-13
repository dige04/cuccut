# Font probes

These fonts contain only polygon outlines original to this project, released under CC0-1.0.
After installing Python and `fonttools`, regenerate from the repository root:

```sh
python3 crates/render-raster/tests/fixtures/fonts/mk_colr_probe.py
python3 crates/render-raster/tests/fixtures/fonts/mk-cjk-fallback-probe.py
```

- `ColrProbe.ttf` verifies COLR/CPAL rendering and premultiplied colour.
- `cjk-fallback-probe.ttf` covers only U+20BB7 (𠮷). The probe uses the `Source Han Sans SC`
  family name so that it enters the existing CJK fallback chain; it contains no outlines from that
  font. The tests combine the probe with the bundled Arimo and Noto Sans SC, and do not depend on
  which fonts are installed on the machine.
