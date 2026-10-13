import path from 'node:path';
import { RpcError, type TemplateMessageRef, type TemplateSendRef } from '@cuccut/protocol';
import { localizeTemplate, type LoadedTemplate, type TemplateCatalog } from './template-catalog.ts';
import { RcTemplates } from '@cuccut/protocol/messages/runtime-core';

/**
 * The part of a scene template handed to the agent (template package spec §5.2, §5.4): the shared brief-guidance preamble,
 * the template's default aspect ratio and duration, the `prompt.md` body and the attached assets. The Runtime prepends the
 * preamble; it is not written into each `prompt.md` and not copied into the UI. The session still shows the user's own
 * words, with a template marker.
 */

/**
 * The brief-guidance preamble, following the ten points of spec §5.2. It is written in English, but it is only
 * instructions for the agent: questions and replies follow the user's language, and the language of the finished video is
 * decided in the order of the development process §4, never by the language of the preamble or the template body.
 */
export const SCENE_BRIEF_PREAMBLE = [
  'This is a scene template task. First agree on the brief with the user; until the user confirms it, do not start making anything and do not call tools that cost money or change a video (reading the materials the user gave is fine).',
  '1. The brief has four items: the topic (what to make), the goal (what viewers should do or remember afterwards), the audience, and the materials at hand (files, links or text; none is fine too). Also confirm the aspect ratio and duration: the template defaults given below apply, what the user\'s message says overrides them, and the user may change them; confirm the language of the finished video when needed.',
  '2. Do not ask again for what the user\'s message and attachments already give; read what can be read from the materials first.',
  '3. Gather the missing items into one round of questions, short, each with a default to choose; do not chase item by item.',
  '4. Ask and reply in the user\'s language: follow the language of the user\'s messages, never switch to a language just because these instructions or the template body use it.',
  '5. Do not make any language the default for the finished video: decide it from the user\'s explicit request, then recorded preferences, then the task context; when unsure, confirm it as an item of the brief.',
  '6. Restate the assembled brief to the user and wait for them to confirm or change it; when the user explicitly says to just go ahead, continue with what is known and the defaults, and say in the restatement which items are defaults.',
  '7. Once confirmed, make it following the template body below; where the brief and the body conflict, the brief the user confirmed wins.',
  '8. When a capability the template body asks for is not configured, do not stop: without speech synthesis, let captions carry the narration and dialogue; for music, use local music generation when there is one, otherwise consider synthesizing it in code, and skip it only when that is not possible; without sound-effect generation, first consider synthesizing in code, and skip only when that is not possible; without transcription, image or video generation, use the user\'s materials or code graphics instead. When restating the brief and at delivery, say which requirements were downgraded because of this and which capability, once configured, would fill them in.',
  '9. Before making anything, read video-production (how to go from brief to finished video) with the cuccut tool skills_read; when a recommended reading for this template is listed below, read it as well.',
  '10. Bracketed items such as "[audience]" in the user\'s message are blanks the template left for the user to fill and the user did not fill: ask about them together with the missing brief items, do not treat them as known information, and never copy them into the video as they are.',
].join('\n');

/** A template resolved at send time: the marker on the message, and the part appended to the text handed to the agent. */
export interface ResolvedTemplate {
  ref: TemplateMessageRef;
  instructions: string;
}

/**
 * Resolves the `template` of `conversations.send`: only scene templates are accepted; `version` is only a hint, and the
 * catalog's current version is used; `assets` must be paths registered in the manifest, all assets are attached when it is
 * absent; `language` picks the language version of the template copy (spec §3.6, defaulting to the Runtime's UI language),
 * used for both the marker's title and the template body.
 */
export async function resolveSceneTemplate(catalog: TemplateCatalog, request: TemplateSendRef): Promise<ResolvedTemplate> {
  const template = await catalog.require(request.id);
  const localized = localizeTemplate(template, request.language);
  const { manifest } = localized;
  if (manifest.kind !== 'scene') {
    throw new RpcError('invalid-request', RcTemplates.notScene({ title: manifest.title }), {
      code: 'TEMPLATE_NOT_SCENE',
      templateId: manifest.id,
      kind: manifest.kind,
    });
  }
  const registered = new Set((manifest.assets ?? []).map((a) => a.path));
  for (const asset of request.assets ?? []) {
    if (!registered.has(asset)) {
      throw new RpcError('invalid-request', RcTemplates.assetNotRegistered({ id: manifest.id, asset }), {
        code: 'TEMPLATE_FILE_NOT_FOUND',
        templateId: manifest.id,
        path: asset,
      });
    }
  }
  const kept = request.assets ? new Set(request.assets) : registered;
  return {
    ref: { id: manifest.id, version: manifest.version, title: manifest.title, kind: manifest.kind, origin: template.origin },
    instructions: sceneTemplateBlock({ ...template, manifest, prompt: localized.prompt }, kept),
  };
}

/** The template block handed to the agent: preamble, defaults, body and assets, wrapped in `<cuccut-template>`. `template` is the manifest and body in the chosen language. */
export function sceneTemplateBlock(template: Pick<LoadedTemplate, 'manifest' | 'prompt' | 'dir'>, assets: ReadonlySet<string>): string {
  const { manifest } = template;
  const defaults = [
    manifest.ratio ? `aspect ratio ${manifest.ratio}` : 'aspect ratio automatic',
    manifest.durationSeconds ? `duration ${manifest.durationSeconds} seconds` : 'duration automatic',
  ].join(', ');
  const attached = (manifest.assets ?? []).filter((a) => assets.has(a.path));
  const lines = [
    `<cuccut-template id="${manifest.id}" version="${manifest.version}">`,
    `The user chose the scene template "${manifest.title}".`,
    SCENE_BRIEF_PREAMBLE,
    '',
    `Template defaults: ${defaults}.`,
    ...(manifest.skills?.length ? [`Recommended reading for this template: ${manifest.skills.join(', ')} (read with skills_read).`] : []),
    '',
    'Template body:',
    template.prompt.trim(),
  ];
  if (attached.length) {
    lines.push(
      '',
      'Assets attached to the template (read-only local files; how to use them follows the template body; they are not put into the video automatically):',
      ...attached.map((a) => `- ${JSON.stringify(path.join(template.dir, ...a.path.split('/')))} (${a.type}): ${a.note}`),
    );
  }
  lines.push('</cuccut-template>');
  return lines.join('\n');
}
