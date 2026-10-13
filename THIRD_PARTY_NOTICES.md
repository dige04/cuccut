# Third-Party Notices

CucCut's original material is licensed under the terms in [LICENSE](LICENSE). The third-party code and resources below keep their original licenses; this project's license does not change the rights those components already grant.

Parts of CucCut's code and resources are ported, adapted or copied from the open-source projects listed below. The comments at the top of code files state the source file and the changes; copied resource files are listed in each section.

## File Preview

- PDF.js (Mozilla, `pdfjs-dist`, Apache-2.0): PDF worker, renderer, CMaps, standard fonts and image decoders; fonts, CMaps and decoders keep their own licenses.
- file-type (MIT) and its dependencies: identifies file type from the content prefix, not from the file extension.
- DOMPurify (Cure53, Apache-2.0 OR MPL-2.0): content sanitizing for static HTML previews.

The build collects these notices from the original text in the installed packages and emits them to `assets/file-preview-licenses.txt` for both Electron and Web output (`tools/pdf-licenses.ts`).

## Slide Editor

The editor page and the compiler used by `slides_check` (`apps/slides-editor`) bundle npm packages including React, Base UI, Floating UI, TanStack Virtual, class-variance-authority (Apache-2.0), clsx, tailwind-merge, JSZip (dual-licensed MIT/GPL-3.0; MIT is chosen) and the pako it inlines (MIT and Zlib). The build collects licenses from the original text of the modules actually bundled and writes them to `third-party-licenses.txt` (page) and `node/third-party-licenses.txt` (compiler), distributed with the app's `slides-editor/` resources (`apps/slides-editor/licenses.mjs`).

- PptxGenJS 3.12.0 (Brent Ely, MIT): at build time, 25 extensions are applied per `packages/slides-runtime/patches/pptxgenjs-3.12.0.json` (gradients, tiled fills, rounded image corners, placeholder inheritance, custom themes and masters, etc.); the installed package itself is not modified.
- mediabunny 1.27.3 (Vanilagy and contributors, MPL-2.0): `packages/slides-runtime/src/media/video-worker.ts` embeds its compiled output verbatim as a string, serving as the Worker that re-encodes oversized videos; each section keeps its original MPL license header. Full source at https://github.com/Vanilagy/mediabunny; the full license text is at `packages/slides-runtime/licenses/MPL-2.0.txt` and is also included in the two license files above.

## Design Editor

The editor page (`apps/design-editor`) bundles npm packages including React 19, Base UI, Floating UI, TanStack Virtual, class-variance-authority (Apache-2.0), clsx, tailwind-merge, reselect and usehooks-ts. The build collects licenses from the original text of the modules actually bundled and the embedded files, writes them to `third-party-licenses.txt`, and distributes them with the app's `design-editor/` resources (`apps/design-editor/licenses.mjs`).

- React 18.3.1 and ReactDOM 18.3.1 (Meta, MIT): the artboard runtime `artifact-type/dc-runtime.js` bundles them, separate from the editor UI's React 19; their `umd/*.production.min.js` are embedded verbatim in the page and, when an artboard is exported, are written into the export file together with `support.js` (`vendor/react.js`, `vendor/react-dom.js`).
- Babel standalone 7.29.0 (MIT): the `babel.min.js` from the npm package is distributed with the editor verbatim as `artifact-type/babel.min.js`; it loads only when an artboard x-imports JSX and compiles JSX in the browser. In the HTML export of a whole design it is embedded once, and only when needed.
- dom-to-svg 0.12.2 (MIT) and its dependencies postcss, postcss-value-parser, gradient-parser, nanoid and picocolors: scripts that are injected into artboards and capture them as SVG.
- happy-dom 20.9.0 (MIT), jQuery 4.0.0 (MIT) and its dependencies entities (BSD-2-Clause) and whatwg-mimetype: the fast-edit Worker `artifact-type/fast-edit-worker.js`.

## Design System Editor

The editor page (`apps/design-system-editor`) bundles npm packages including React 19, Base UI, Floating UI, TanStack Virtual, class-variance-authority (Apache-2.0), clsx, tailwind-merge, reselect and use-sync-external-store. The build collects licenses from the original text of the modules actually bundled and the files served with the page, writes them to `third-party-licenses.txt`, and distributes them with the app's `design-system-editor/` resources (`apps/design-system-editor/licenses.mjs`).

- React 18.3.1 and ReactDOM 18.3.1 (Meta, MIT): their `umd/*.production.min.js` are placed verbatim under the page's `artifact-type/vendor/`; component previews load them on demand, separate from the editor UI's React 19.

## Paseo

- Source: Paseo (https://github.com/getpaseo/paseo)
- Copyright (c) 2025-present Mohamed Boudra
- License: Apache License, Version 2.0 (full text below)

CucCut files that port or rewrite part of its mechanisms (modified from the original; the changes are described in the comments at the top of each file):

- `packages/agent-drivers/src/acp/acp-connection.ts`
- `packages/agent-drivers/src/acp/acp-driver.ts`
- `packages/agent-drivers/src/acp/acp-items.ts`
- `packages/agent-drivers/src/acp/acp-presets.ts`
- `packages/agent-drivers/src/acp/acp-session.ts`
- `packages/agent-drivers/src/claude/claude-binary.ts`
- `packages/agent-drivers/src/claude/claude-models.ts`
- `packages/agent-drivers/src/claude/claude-query.ts`
- `packages/agent-drivers/src/claude/claude-session.ts`
- `packages/agent-drivers/src/codex/codex-models.ts`
- `packages/agent-drivers/src/codex/codex-session.ts`
- `packages/agent-drivers/src/opencode/opencode-binary.ts`
- `packages/agent-drivers/src/opencode/opencode-driver.ts`
- `packages/agent-drivers/src/opencode/opencode-items.ts`
- `packages/agent-drivers/src/opencode/opencode-models.ts`
- `packages/agent-drivers/src/opencode/opencode-preset.ts`
- `packages/agent-drivers/src/opencode/opencode-server.ts`
- `packages/agent-drivers/src/opencode/opencode-session.ts`
- `packages/agent-drivers/src/pi/pi-driver.ts`
- `packages/agent-drivers/src/pi/pi-items.ts`
- `packages/agent-drivers/src/pi/pi-models.ts`
- `packages/agent-drivers/src/pi/pi-rpc-process.ts`
- `packages/agent-drivers/src/pi/pi-session.ts`
- `packages/ui/src/model/composer-completions.ts`
- `packages/ui/src/model/message-queue.ts`
- `packages/ui/src/runtime/message-queue-runner.ts`

### Apache License, Version 2.0

```text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

## speech-swift

- Source: [speech-swift](https://github.com/soniqo/speech-swift) (soniqo; the original copyright notice is `Copyright 2025 Ivan Digital`)
- License: Apache License, Version 2.0; the [verbatim copy of the upstream LICENSE](crates/model-runtime/licenses/speech-swift.txt) retains the full terms, copyright and disclaimer.

Parts of CucCut's Qwen3-ASR, Whisper, forced alignment, Silero VAD, Qwen3-TTS, VoxCPM2, OmniVoice, IndexTTS2 and HTDemucs source-separation implementations are referenced from or adapted from this project (some were first ported to an earlier version (v2), then moved into the current project). The related Swift implementations have been rewritten in Rust and adapted to CucCut's MLX / candle tensor backends, manifest-driven model packages, and error and task interfaces; inference and pre/post-processing were further aligned with each model's official implementation. Each related implementation file keeps, at its top, the copyright, source-file and modification notices, and the source notes of the original model upstreams are retained as well. ASR files state the reference relationship: the algorithm is implemented in Rust, and the MLX and candle backends carry this project's own adaptations; Whisper still retains the source note of an earlier Swift implementation.

The files below contain referenced or adapted parts; the table distinguishes two kinds of relationship. It does not mean that a whole file comes from speech-swift, nor does it cover code that merely uses the same models or frameworks. Licenses for model weights, lexicons and voice recordings are independent of this project's code license and remain under their own source notices.

| CucCut file (relative to repo root) | speech-swift source file (relative to upstream root) | How it is used |
| --- | --- | --- |
| `crates/model-runtime/src/backend/candle/aligner.rs` | `Sources/Qwen3ASR/ForcedAligner.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/candle/audio_encoder.rs` | `Sources/Qwen3ASR/AudioEncoder.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/candle/layers.rs` | `Sources/Qwen3ASR/QuantizedTextDecoder.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/candle/qwen3.rs` | `Sources/Qwen3ASR/Qwen3ASR.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/candle/silero.rs` | `Sources/SpeechVAD/SileroModel.swift / Sources/SpeechVAD/SileroVAD.swift / Sources/SpeechVAD/SileroWeightLoading.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/candle/text_decoder.rs` | `Sources/Qwen3ASR/QuantizedTextDecoder.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/candle/weights.rs` | `Sources/Qwen3ASR/WeightLoading.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/coreml/whisper.rs` | `Sources/WhisperASR/WhisperCoreMLRuntime.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/mlx/aligner.rs` | `Sources/Qwen3ASR/ForcedAligner.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/mlx/qwen3/audio_encoder.rs` | `Sources/Qwen3ASR/AudioEncoder.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/mlx/qwen3/layers.rs` | `Sources/Qwen3ASR/QuantizedTextDecoder.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/mlx/qwen3/model.rs` | `Sources/Qwen3ASR/Qwen3ASR.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/mlx/qwen3/text_decoder.rs` | `Sources/Qwen3ASR/QuantizedTextDecoder.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/mlx/qwen3/weights.rs` | `Sources/Qwen3ASR/WeightLoading.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/backend/mlx/silero.rs` | `Sources/SpeechVAD/SileroModel.swift / Sources/SpeechVAD/SileroVAD.swift / Sources/SpeechVAD/SileroWeightLoading.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/separate/config.rs` | `Sources/SourceSeparation/HTDemucs/HTDemucsConfig.swift` | Ported and adapted |
| `crates/model-runtime/src/separate/htdemucs/layers.rs` | `Sources/SourceSeparation/HTDemucs/HTDemucsLayers.swift` | Ported and adapted |
| `crates/model-runtime/src/separate/htdemucs/model.rs` | `Sources/SourceSeparation/HTDemucs/HTDemucs.swift` | Ported and adapted |
| `crates/model-runtime/src/separate/htdemucs/separator.rs` | `Sources/SourceSeparation/HTDemucs/HTDemucsSeparator.swift` | Ported and adapted |
| `crates/model-runtime/src/separate/htdemucs/transformer.rs` | `Sources/SourceSeparation/HTDemucs/HTDemucsTransformer.swift` | Ported and adapted |
| `crates/model-runtime/src/separate/segment.rs` | `Sources/SourceSeparation/HTDemucs/HTDemucsSeparator.swift` | Ported and adapted |
| `crates/model-runtime/src/separate/stft.rs` | `Sources/SourceSeparation/HTDemucs/HTDemucsSpec.swift` | Ported and adapted |
| `crates/model-runtime/src/speech/align_common.rs` | `Sources/Qwen3ASR/ForcedAligner.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/speech/decoding.rs` | `Sources/Qwen3ASR/Qwen3ASR.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/speech/mel.rs` | `Sources/Qwen3ASR/AudioPreprocessing.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/speech/qwen3_asr.rs` | `Sources/Qwen3ASR/Configuration.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/speech/text_prep.rs` | `Sources/Qwen3ASR/TextPreprocessing.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/speech/timestamp.rs` | `Sources/Qwen3ASR/TimestampCorrection.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/speech/tokenizer.rs` | `Sources/AudioCommon/Tokenizer.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/speech/whisper_decoding.rs` | `Sources/WhisperASR/WhisperGenerationConfig.swift / Sources/WhisperASR/WhisperByteLevelTokenizer.swift` | Reference implementation, rewritten in Rust |
| `crates/model-runtime/src/synthesize/index_tts2/config.rs` | `Sources/IndexTTS2TTS/IndexTTS2RuntimeConfig.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/dsp.rs` | `Sources/SpeechRestoration/SeamlessM4TFrontEnd.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/mlx/bigvgan.rs` | `Sources/IndexTTS2TTS/IndexTTS2BigVGAN.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/mlx/campplus.rs` | `Sources/ChatterboxTTS/CAMPPlus.swift / Sources/IndexTTS2TTS/IndexTTS2CAMPPlusAdapter.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/mlx/engine_impl.rs` | `Sources/IndexTTS2TTS/IndexTTS2NativeRuntime.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/mlx/gpt.rs` | `Sources/IndexTTS2TTS/IndexTTS2SemanticGPT.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/mlx/layers.rs` | `Sources/IndexTTS2TTS/IndexTTS2SemanticGPT.swift / Sources/IndexTTS2TTS/IndexTTS2BigVGAN.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/mlx/s2mel.rs` | `Sources/IndexTTS2TTS/IndexTTS2S2Mel.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/mlx/semantic_codec.rs` | `Sources/IndexTTS2TTS/IndexTTS2SemanticCodec.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/mlx/w2v_bert.rs` | `Sources/IndexTTS2TTS/IndexTTS2Wav2Vec2Bert.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/mlx/weights.rs` | `Sources/MLXCommon/WeightLoading.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/normalizer.rs` | `Sources/IndexTTS2TTS/IndexTTS2TextNormalizer.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/sampling.rs` | `Sources/IndexTTS2TTS/IndexTTS2SemanticGPT.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/segmenter.rs` | `Sources/IndexTTS2TTS/IndexTTS2TextSegmenter.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/sentencepiece.rs` | `Sources/AudioCommon/SentencePieceModel.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/index_tts2/tokenizer.rs` | `Sources/IndexTTS2TTS/IndexTTS2Tokenizer.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/omnivoice/backbone.rs` | `Sources/OmniVoiceTTS/OmniVoiceBackbone.swift / Sources/OmniVoiceTTS/OmniVoiceDiffusion.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/omnivoice/codec.rs` | `Sources/OmniVoiceTTS/OmniVoiceCodec.swift / Sources/OmniVoiceTTS/OmniVoiceCodecEncoder.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/omnivoice/config.rs` | `Sources/OmniVoiceTTS/Configuration.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/omnivoice/engine.rs` | `Sources/OmniVoiceTTS/OmniVoiceModel.swift / Sources/OmniVoiceTTS/OmniVoiceTTSModel.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/code_predictor.rs` | `Sources/Qwen3TTS/CodePredictor.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/codec_decoder.rs` | `Sources/Qwen3TTS/SpeechTokenizerDecoder.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/codec_encoder.rs` | `Sources/Qwen3TTS/SpeechTokenizerEncoder.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/config.rs` | `Sources/Qwen3TTS/Configuration.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/engine.rs` | `Sources/Qwen3TTS/Qwen3TTS.swift / Sources/Qwen3TTS/Qwen3TTS+ICL.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/layers.rs` | `Sources/Qwen3TTS/Talker.swift / Sources/Qwen3TTS/CodePredictor.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/mel.rs` | `Sources/Qwen3TTS/SpeakerEncoder.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/prompt.rs` | `Sources/Qwen3TTS/Qwen3TTS.swift / Sources/Qwen3TTS/Qwen3TTS+ICL.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/sampling.rs` | `Sources/Qwen3TTS/Sampling.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/speaker_encoder.rs` | `Sources/Qwen3TTS/SpeakerEncoder.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/talker.rs` | `Sources/Qwen3TTS/Talker.swift / Sources/Qwen3TTS/CodePredictor.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/tokens.rs` | `Sources/Qwen3TTS/Configuration.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/qwen3_tts/weights.rs` | `Sources/Qwen3TTS/TTSWeightLoading.swift / Sources/Qwen3TTS/TTSWeightLoading+Encoder.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/voxcpm2/audio_vae.rs` | `Sources/VoxCPM2TTS/AudioVAE.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/voxcpm2/config.rs` | `Sources/VoxCPM2TTS/Configuration.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/voxcpm2/engine.rs` | `Sources/VoxCPM2TTS/VoxCPM2TTS.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/voxcpm2/minicpm.rs` | `Sources/VoxCPM2TTS/MiniCPM4.swift / Sources/VoxCPM2TTS/VoxCPM2TTS.swift` | Ported and adapted |
| `crates/model-runtime/src/synthesize/voxcpm2/tokenizer.rs` | `Sources/VoxCPM2TTS/VoxCPM2TTS.swift` | Ported and adapted |

The `mod.rs` files of the TTS and source-separation modules also summarize the source and scope of modifications. The upstream license copy and source paths were checked against speech-swift `1f54e56cf137078ed681a03e0955e777f7314610`; this version identifier is used to locate the source of the notices and does not mean the current implementation is identical to that version.

This notice and the upstream license copy are distributed with the desktop and Web builds; the desktop installer keeps directly readable copies at `resources/THIRD_PARTY_NOTICES.md` and `resources/crates/model-runtime/licenses/speech-swift.txt`.

## lobe-icons

- Source: lobe-icons (https://github.com/lobehub/lobe-icons)
- Copyright (c) 2023 LobeHub
- License: MIT License (full text below)

Provider icons copied verbatim into `packages/ui/src/components/vendor-icons/` (the icons in the app's agent picker; content unmodified, only the file names were changed to the provider id; the `<title>` and `style="flex:none;line-height:1"` in each file are its original markup):

- `packages/ui/src/components/vendor-icons/anthropic.svg`
- `packages/ui/src/components/vendor-icons/codex.svg` (originally named `codex-color.svg`)
- `packages/ui/src/components/vendor-icons/cursor.svg`
- `packages/ui/src/components/vendor-icons/githubcopilot.svg`
- `packages/ui/src/components/vendor-icons/google.svg` (originally named `gemini-color.svg`)
- `packages/ui/src/components/vendor-icons/moonshot.svg` (originally named `kimi.svg`)
- `packages/ui/src/components/vendor-icons/opencode.svg`
- `packages/ui/src/components/vendor-icons/pi.svg`
- `packages/ui/src/components/vendor-icons/xai.svg`

### MIT License

```text
MIT License

Copyright (c) 2023 LobeHub

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Spectrum 2 Icons

- Source: Adobe React Spectrum (https://github.com/adobe/react-spectrum), the workflow icons of `@react-spectrum/s2`
- License: Apache License, Version 2.0 (full text in the Paseo section above)

CucCut uses the workflow icons of `@react-spectrum/s2` as published, unmodified.

## HyperFrames

- Source: HyperFrames (https://github.com/hyperframes/hyperframes)
- License: Apache License, Version 2.0 (full text in the Paseo section above)

CucCut implements the public author contract of HyperFrames (contract identifier `hyperframes/1`): the `data-*` attributes of the root element (`data-composition-id`, `data-width`, `data-height`, `data-fps`, `data-duration`) and `window.__timelines[id].seek`, used to validate, capture frames from, and bake code bundles written to this contract ([code bundle spec §4.7](docs/spec/code-bundle-spec.md#47-hyperframes)). CucCut has not ported, adapted or copied HyperFrames code or resources, and does not distribute them with the app; this section only states the source of this contract.

## smol-toml

TOML parsing of configuration from earlier versions uses smol-toml (Squirrel Chat, BSD-3-Clause). It is distributed with the Runtime build; the original license follows:

```text
Copyright (c) Squirrel Chat et al., All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## keyring

Reading and writing Windows Credential Manager uses keyring (keyring Developers); this distribution elects the MIT license:

```text
Copyright (c) 2016 keyring Developers

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## YuNet face detection model

`packages/models/assets/face-detection/yunet-2023mar.onnx` is the YuNet model from OpenCV Zoo (`face_detection_yunet_2023mar.onnx`; content unchanged, only the file name was changed), distributed with the app; `videos_frames` uses it to mark face boxes in each frame. The source (pinned to a commit), SHA-256 and the original license text are in `COPYING.txt` in the same directory.

- Source: https://github.com/opencv/opencv_zoo/tree/f12e12798e8314f7c074a6656816c048dcc95b7a/models/face_detection_yunet
- License: MIT License, Copyright (c) 2020 Shiqi Yu

## tract

The face detection process `face-detect` (`crates/face-detect`) uses tract (Sonos, `tract-onnx` and its dependent `tract-*` crates) for pure-Rust ONNX inference, compiled into the native program distributed with the app. tract is released under MIT OR Apache-2.0; this distribution elects the MIT license:

```text
Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```
