# CucCut App Icon

Drawing source and export script for the app icon. The graphic is three horizontal tracks forming a rounded play button, cut by a playhead with a starburst. One brand-color tile, a white graphic, and one light clip strip: three colors across the whole image. Design rationale: [`docs/design/brand/app-icon.md`](../../docs/design/brand/app-icon.md).

| File | Purpose |
| --- | --- |
| `app-icon.mjs` | Drawing source. Geometry is in `GEOMETRY`, color variants in `VARIANTS`; `svg(variant, { shadow })` returns the SVG string on a 1024 canvas. Pure function, no browser dependency |
| `render.mjs` | Export script. Uses the repo's bundled Electron to draw the SVG on a canvas separately at each target size (not downscaled from the large image), and writes every output listed in the table below |

Outputs are not edited by hand. After changing `app-icon.mjs`, rerun from the repo root:

```bash
npm run icons                                 # write all outputs back into the repo
node tools/app-icon/render.mjs --out /tmp/x   # write to a temp directory only, for preview
```

| Output | Contents |
| --- | --- |
| `designs/cuccut/assets/app-icon.svg` | Vector version on a 1024 canvas, with the macOS template shadow; the prototype's update dialog uses it |
| `apps/desktop/build/icon.png` | 1024 PNG, with the template shadow |
| `apps/desktop/build/icon.icns` | iconset 16–512, each with an @2x variant, with the template shadow, packed with `iconutil` |
| `apps/desktop/build/icon.ico` | 32-bit PNG entries at 16 / 20 / 24 / 32 / 40 / 48 / 64 / 128 / 256, **without** the shadow (Windows does not expect the icon to carry its own shadow) |

Dependencies: `node_modules/electron` (installed by the root `npm ci`) and macOS's built-in `iconutil`, so this only runs on macOS. Because export can only happen on macOS, these outputs are **committed to git** (an exception to [repo convention §"Generated files are not committed"](../../docs/repo-conventions.md)): the Windows packaging workflow reads the committed `icon.ico` directly on a Windows runner, and the prototype and electron-builder also read the files directly rather than re-exporting them at build time. The `sandbox_extension_issue_file` line that Electron prints at startup is a harmless notice.
