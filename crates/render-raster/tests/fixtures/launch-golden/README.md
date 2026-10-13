# launch-golden: BCF compile/parse golden

BCF authoring-layer source files and reference artifacts for the CucCut release clip (`launch`). This directory is the only input for the golden tests. It always exists on a fresh checkout, and the tests always read it strictly and never skip.

| File | Role |
| --- | --- |
| `launch.ccut.tsx` | Authoring-layer source file (compile input). |
| `bcf.tsx` | Relative import target of `launch.ccut.tsx`, a **frozen copy**. |
| `launch.ccut.json` | Reference artifact (golden); `ccut compile` must be deep-equal to it. |

## Source

From the archived `prototype/` surface, archive baseline commit `a8c049a3`:

- `launch.ccut.tsx` ← `prototype/react-authoring/src/launch.ccut.tsx`
- `bcf.tsx` ← `prototype/react-authoring/src/bcf.tsx`
- `launch.ccut.json` ← `prototype/out/launch.ccut.json` (React/esbuild toolchain output,
  previously gitignored; promoted to a tracked fixture in this change)

To retrieve the original surface:

```bash
git show a8c049a3:prototype/react-authoring/src/launch.ccut.tsx
git checkout a8c049a3 -- prototype/
```

## Discipline

- `bcf.tsx` is a **frozen** copy, kept only so the historical golden stays reproducible. It is **not part of** the sync discipline between `core/runtime/dsl/bcf.tsx` and the animation template `preview/vendor/dsl.tsx`. Do not modify it to keep up with DSL evolution. The current `core/runtime/dsl/bcf.tsx` is a strict superset of it.
- `launch.ccut.json` is updated only when the compile semantics intentionally change, using:
  `ccut compile core/fixtures/launch-golden/launch.ccut.tsx -o core/fixtures/launch-golden/launch.ccut.json`
- The prototype's `launch.mp4` and keyframe PNGs are **not checked in** (for size reasons, and because they were already gitignored and cannot be retrieved from git). SSIM comparison can only be enabled on demand, after a reference video is generated separately on this machine; see the `CCUT_LAUNCH_REF_MP4` switch in steps 4/5 of `core/verify.sh`.
