import { z } from 'zod';

/**
 * The operation families of `edits_apply` (command and protocol spec §4.2): each operation's description, the JSON Schema of
 * its arguments and a minimal example. `edits_ops` lists them verbatim and the `edits_apply` description is assembled from
 * these descriptions, so the two never drift apart.
 *
 * The schemas describe the shape an agent writes (before `normalizeOperations` fills it into the engine's canonical shape):
 * times in seconds, `sequenceId` and `alignment` optional. Field values and where they apply are still validated by the
 * engine; this only gives the shape, values and descriptions, and `edits_apply` does not reject anything up front by it.
 */

/** Operation families: the same grouping as the table in command and protocol spec §4.2 (only those agents can use). */
export const OPERATION_FAMILIES = [
  'assets',
  'items',
  'styles',
  'transitions-and-effects',
  'chapters-and-ducking',
  'speech',
  'code',
  'tracks-and-sequences',
  'documents-and-versions',
] as const;
export type OperationFamily = (typeof OPERATION_FAMILIES)[number];

export interface EditOperationSpec {
  type: string;
  family: OperationFamily;
  /** The line(s) in the `edits_apply` description: shape and semantics. */
  doc: readonly string[];
  schema: z.ZodType;
  example: Record<string, unknown>;
}

const idOf = (what: string) => z.string().min(1).describe(what);
const time = z
  .union([
    z.number(),
    z.string(),
    z.object({
      unit: z.enum(['frames', 'seconds']).describe('frames, or seconds (a decimal seconds string)'),
      value: z.union([z.number(), z.string()]).describe('Number of frames or seconds'),
    }),
  ])
  .describe('Time: seconds (a number or numeric string, e.g. 1.5); {"unit":"frames","value":30} also works');
const seconds = z.union([z.number(), z.string()]).describe('Seconds (a number or decimal string)');
const nullableNumber = (what: string) => z.number().nullable().optional().describe(`${what}; null restores the default`);
const ref = z.string().optional().describe('Name that later operations in the same edit use to refer to it');
const assetTarget = z
  .union([idOf('Asset ID'), z.object({ assetId: idOf('Asset ID') }), z.object({ ref: z.string().describe('The ref of an importAsset') })])
  .describe('Asset: an asset ID, {"assetId"}, or {"ref"} of an importAsset in the same edit');
const sequenceId = z.string().optional().describe('Sequence ID; the root sequence when omitted');
const timed = {
  sequenceId,
  alignment: z
    .enum(['nearest-frame', 'exact-frame', 'floor-frame', 'ceil-frame'])
    .optional()
    .describe('How times snap to frames: nearest-frame (default), exact-frame, floor-frame, ceil-frame'),
};

function op(type: string, fields: z.ZodRawShape) {
  return z.object({ type: z.literal(type).describe('Operation type'), ...fields });
}

export const EDIT_OPERATIONS: readonly EditOperationSpec[] = [
  {
    type: 'importAsset',
    family: 'assets',
    doc: [
      '- {"type":"importAsset","path":"media file (relative to the working directory, or absolute)","name"?:"asset name","ref"?:"name to refer to it within the same edit","storage"?:"linked"|"managed"}: registers a media file as an asset of the video. Defaults to linked: the file stays where it is and is not copied; the video only records its location, so moving or deleting the file later leaves the asset missing. Only "storage":"managed" copies the bytes into the video folder (when the user asks for it to be copied into the video, or the file is a temporary file you generated and will clean up).',
      '- {"type":"importAsset","artifactId":"sha256:…","name"?,"ref"?}: imports a generated artifact (an artifactId from the outputs of jobs_inspect) as an asset without regenerating it; its provenance records that generation, and the bytes are always collected into the video (managed). Give exactly one of path and artifactId.',
    ],
    schema: op('importAsset', {
      path: z.string().optional().describe('Media file: relative to the working directory, or absolute; give exactly one of this and artifactId'),
      artifactId: z.string().optional().describe('A generated or downloaded artifact (an artifactId from the outputs of jobs_inspect); give exactly one of this and path'),
      name: z.string().optional().describe('Asset name'),
      ref: ref,
      storage: z
        .enum(['linked', 'managed'])
        .optional()
        .describe('linked (default, the file stays where it is) or managed (copied into the video folder); artifacts are always managed'),
    }),
    example: { type: 'importAsset', path: 'demo.mp4', ref: 'clip' },
  },
  {
    type: 'collectAssets',
    family: 'assets',
    doc: [
      '- {"type":"collectAssets","assetIds":["asset ID"]}: collects the bytes of linked assets into the video folder (linked -> managed) without changing the asset revision; assets already in the video are left alone.',
    ],
    schema: op('collectAssets', {
      assetIds: z.array(idOf('Asset ID')).min(1).describe('Linked assets to collect into the video folder'),
    }),
    example: { type: 'collectAssets', assetIds: ['asset_1'] },
  },
  {
    type: 'removeAssets',
    family: 'assets',
    doc: [
      '- {"type":"removeAssets","assetIds":["asset ID"]}: removes assets that nothing references any more from the video (no item or its prerender proxy, chapter thumbnail or document source points to them); rejected while still referenced (details.usedBy lists what uses them). A code bundle and the prerender proxy baked from it are removed as a pair. Use assets_prune first to see what can be removed.',
    ],
    schema: op('removeAssets', {
      assetIds: z.array(idOf('Asset ID')).min(1).describe('Unreferenced assets to remove'),
    }),
    example: { type: 'removeAssets', assetIds: ['asset_1'] },
  },
  {
    type: 'addItem',
    family: 'items',
    doc: [
      '- {"type":"addItem","asset":"asset ID" or {"ref":"ref of an importAsset"},"at"?:seconds,"trackId"?,"name"?}: places an asset on the timeline; without at it is appended to the end of the track, and without trackId it goes on the first unlocked track of the matching kind (video and images on a visual track, audio on an audio track).',
    ],
    schema: op('addItem', {
      asset: assetTarget,
      at: time.optional().describe('Start time; appended to the end of the track when omitted'),
      trackId: idOf('Track ID').optional().describe('Track to place it on; the first unlocked track of the matching kind when omitted'),
      name: z.string().optional().describe('Item name'),
      ...timed,
    }),
    example: { type: 'addItem', asset: { ref: 'clip' }, at: 1 },
  },
  {
    type: 'moveItem',
    family: 'items',
    doc: [
      '- {"type":"moveItem","itemId","at"?:seconds,"offset"?:seconds,"trackId"?}: moves an item; at is the new start time, offset a relative move (may be negative); give one or the other.',
    ],
    schema: op('moveItem', {
      itemId: idOf('Item ID'),
      at: time.optional().describe('New start time; either this or offset'),
      offset: time.optional().describe('Relative move (may be negative); either this or at'),
      trackId: idOf('Track ID').optional().describe('Track to move to; stays on its track when omitted'),
      ...timed,
    }),
    example: { type: 'moveItem', itemId: 'item_1', at: 5 },
  },
  {
    type: 'arrangeItem',
    family: 'items',
    doc: [
      '- {"type":"arrangeItem","itemId","direction":"forward"|"backward"|"front"|"back"}: changes the stacking order of a visual item (bring forward one level / send backward one level / bring to front / send to back). Stacking order is the order of tracks: an item sharing a track with other items is moved onto a new adjacent track, an item alone on its track moves the whole track; rejected when it is already at the front / back.',
    ],
    schema: op('arrangeItem', {
      itemId: idOf('Item ID'),
      direction: z.enum(['forward', 'backward', 'front', 'back']).describe('forward one level up, backward one level down, front to the top, back to the bottom'),
      sequenceId,
    }),
    example: { type: 'arrangeItem', itemId: 'item_1', direction: 'forward' },
  },
  {
    type: 'moveItems',
    family: 'items',
    doc: ['- {"type":"moveItems","moves":[{"itemId","at"?,"offset"?,"trackId"?}]}: moves several items at once.'],
    schema: op('moveItems', {
      moves: z
        .array(
          z.object({
            itemId: idOf('Item ID'),
            at: time.optional().describe('New start time; either this or offset'),
            offset: time.optional().describe('Relative move (may be negative)'),
            trackId: idOf('Track ID').optional().describe('Track to move to'),
          }),
        )
        .min(1)
        .describe('How to move each item'),
      ...timed,
    }),
    example: {
      type: 'moveItems',
      moves: [
        { itemId: 'item_1', offset: 2 },
        { itemId: 'item_2', offset: 2 },
      ],
    },
  },
  {
    type: 'trimItem',
    family: 'items',
    doc: ['- {"type":"trimItem","itemId","edge":"start"|"end","at":seconds}: trims the start or end of an item; at is the new timeline position of that edge.'],
    schema: op('trimItem', {
      itemId: idOf('Item ID'),
      edge: z.enum(['start', 'end']).describe('Edge to trim: start or end'),
      at: time.describe('New timeline position of that edge'),
      ...timed,
    }),
    example: { type: 'trimItem', itemId: 'item_1', edge: 'end', at: 8 },
  },
  {
    type: 'splitItem',
    family: 'items',
    doc: [
      '- {"type":"splitItem","itemId","at":seconds}: splits an item in two at this timeline position; keyframes are divided by the window of each half, and when trimming, keyframes stay with the content.',
    ],
    schema: op('splitItem', {
      itemId: idOf('Item ID'),
      at: time.describe('Timeline position to split at'),
      ...timed,
    }),
    example: { type: 'splitItem', itemId: 'item_1', at: 3.5 },
  },
  {
    type: 'joinItems',
    family: 'items',
    doc: [
      '- {"type":"joinItems","itemIds":["item ID","item ID"],"keep"?:"first"|"second"}: merges two abutting (end-to-start) items on the same track, taken from the same asset with contiguous source time, back into one (the inverse of a split); keyframes are joined back too. Fails when their other settings differ, with details.keys listing the differing fields; then use keep to say whether to take the settings of the first or the second of itemIds.',
    ],
    schema: op('joinItems', {
      itemIds: z.array(idOf('Item ID')).length(2).describe('Two abutting (end-to-start) items on the same track'),
      keep: z.enum(['first', 'second']).optional().describe('When settings differ, take those of the first or the second of itemIds'),
    }),
    example: { type: 'joinItems', itemIds: ['item_1', 'item_2'] },
  },
  {
    type: 'deleteItems',
    family: 'items',
    doc: ['- {"type":"deleteItems","itemIds":["..."]}: deletes items (other items do not move; a gap is left).'],
    schema: op('deleteItems', {
      itemIds: z.array(idOf('Item ID')).min(1).describe('Items to delete (other items do not move)'),
      sequenceId,
    }),
    example: { type: 'deleteItems', itemIds: ['item_1'] },
  },
  {
    type: 'removeRange',
    family: 'items',
    doc: [
      '- {"type":"removeRange","from":seconds,"to":seconds,"trackIds":["..."]}: ripple delete: removes this span of time on the listed tracks and shifts what follows earlier to close the gap (cutting a sentence or a pause from a talking-head recording). Video and audio items covering the span are split and their middle removed; text, image and caption items are shortened; later items move earlier. Tracks not listed are untouched, so list the voice-over and caption tracks that must move with the picture; if a listed track or an item to be changed is locked, the whole edit fails (TARGET_LOCKED). Captions projected through a split item move with it.',
    ],
    schema: op('removeRange', {
      from: time.describe('Start'),
      to: time.describe('End'),
      trackIds: z.array(idOf('Track ID')).min(1).describe('Tracks to delete on and shift; list the voice-over and caption tracks that must move together'),
      ...timed,
    }),
    example: { type: 'removeRange', from: 12, to: 15.5, trackIds: ['track_v1', 'track_a1'] },
  },
  {
    type: 'updateItem',
    family: 'items',
    doc: [
      '- {"type":"updateItem","itemId","name"?,"enabled"?,"locked"?,"followPolicy"?}: changes an item\'s name (an empty string clears it), enabled, locked and follow policy. followPolicy is replaced as a whole: {"kind":"follow-cuts"} (the default for new items; moves and shortens with cuts), {"kind":"sequence-fixed"} (pinned to a moment on the timeline; cuts do not move it) or {"kind":"item-local","itemId":"target item ID"} (keeps its position relative to that item: moves when the target is moved, split or has its start trimmed, and is deleted with the target, reported in removedWithTarget of the receipt). When a word-following speech-anchor cannot be resolved, the item stays where it is and is listed in orphanedAnchors of the receipt.',
    ],
    schema: op('updateItem', {
      itemId: idOf('Item ID'),
      name: z.string().optional().describe('Item name; an empty string clears it'),
      enabled: z.boolean().optional().describe('Enabled'),
      locked: z.boolean().optional().describe('Locked'),
      followPolicy: z
        .object({
          kind: z.enum(['follow-cuts', 'sequence-fixed', 'item-local']).describe('follow-cuts, sequence-fixed or item-local'),
          itemId: idOf('The target item to follow with item-local').optional(),
        })
        .optional()
        .describe('Follow policy, replaced as a whole'),
      sequenceId,
    }),
    example: { type: 'updateItem', itemId: 'item_1', followPolicy: { kind: 'sequence-fixed' } },
  },
  {
    type: 'setSpeed',
    family: 'items',
    doc: [
      '- {"type":"setSpeed","itemId","rate":{"num":3,"den":2}}: constant speed change for video and audio (0.1x to 10x, the fraction must be in lowest terms); the source range used stays the same and the duration changes accordingly; fails if the item would then overlap the next item.',
    ],
    schema: op('setSpeed', {
      itemId: idOf('Video or audio item ID'),
      rate: z
        .object({ num: z.number().int().positive().describe('Numerator'), den: z.number().int().positive().describe('Denominator') })
        .describe('Rate (a fraction in lowest terms), 0.1x to 10x'),
      sequenceId,
    }),
    example: { type: 'setSpeed', itemId: 'item_1', rate: { num: 3, den: 2 } },
  },
  {
    type: 'setTransform',
    family: 'styles',
    doc: [
      '- {"type":"setTransform","itemId","x"?,"y"?,"w"?,"scale"?,"scaleY"?,"rot"?,"flipX"?,"flipY"?}: changes where an item sits in the picture, as percentages of the frame: x, y are the box center (0-100, 50 is the middle, increasing rightward and downward), w is the box width as a percentage of the frame width, with the height derived from the content aspect ratio; scale scales uniformly, scaleY additionally multiplies the height, rot is the clockwise angle around the center. Only the given fields change; null restores the per-kind default. Video and images filling the canvas (mode fullscreen) ignore x, y, w and scale and honor only rotation and flips; to position them, first switch mode to pip with setStyle. When the canvas size changes, items follow the canvas. Captions and audio have no transform.',
    ],
    schema: op('setTransform', {
      itemId: idOf('Visual item ID'),
      x: nullableNumber('Horizontal position of the box center (percentage of frame width, 50 is the middle)'),
      y: nullableNumber('Vertical position of the box center (percentage of frame height)'),
      w: nullableNumber('Box width as a percentage of frame width'),
      scale: nullableNumber('Uniform scale'),
      scaleY: nullableNumber('Extra scale multiplied onto the height'),
      rot: nullableNumber('Clockwise angle around the center'),
      flipX: z.boolean().optional().describe('Flip horizontally'),
      flipY: z.boolean().optional().describe('Flip vertically'),
      sequenceId,
    }),
    example: { type: 'setTransform', itemId: 'item_1', x: 75, y: 25, w: 30 },
  },
  {
    type: 'setStyle',
    family: 'styles',
    doc: [
      '- {"type":"setStyle","itemId","mode"?:"fullscreen"|"pip","fit"?:"cover"|"contain","bg"?:"blur"|"black"|"#RRGGBB","opacity"?,"radius"?,"mask"?:{"shape":"ellipse","feather"?},"crop"?:{"left","top","right","bottom"},"style"?:{…},"verticalAlign"?:"top"|"center"|"bottom"}: changes how an item looks; only the given fields change, and null restores the default. mode applies only to video, images, asset stickers, placeholders and whiteboards: fullscreen fills the canvas (the picture-in-picture position and width are kept and come back when switching back to pip), pip places it by the position and width from setTransform; the default is pip. fit is whether filling crops (cover) or letterboxes (contain), and bg is the letterbox background. opacity is 0 to 1; radius is the corner radius in pixels relative to a 540 short edge; the mask feather is at least 0; crop is a 0-to-1 fraction per edge, with left + right and top + bottom each below 1, for video and images only. style and verticalAlign apply only to text items.',
    ],
    schema: op('setStyle', {
      itemId: idOf('Visual item ID'),
      mode: z.enum(['fullscreen', 'pip']).nullable().optional().describe('fullscreen (fills the canvas) or pip (picture in picture)'),
      fit: z.enum(['cover', 'contain']).nullable().optional().describe('When filling: cover (crop) or contain (letterbox)'),
      bg: z.string().nullable().optional().describe('Letterbox background: blur, black or #RRGGBB'),
      opacity: nullableNumber('Opacity, 0 to 1'),
      radius: nullableNumber('Corner radius, in pixels relative to a 540 short edge'),
      mask: z
        .object({ shape: z.literal('ellipse').describe('ellipse'), feather: z.number().optional().describe('Feather, at least 0') })
        .nullable()
        .optional()
        .describe('Mask'),
      crop: z
        .object({
          left: z.number().describe('Fraction cropped from the left'),
          top: z.number().describe('Fraction cropped from the top'),
          right: z.number().describe('Fraction cropped from the right'),
          bottom: z.number().describe('Fraction cropped from the bottom'),
        })
        .nullable()
        .optional()
        .describe('Crop (video and images), 0 to 1 per edge'),
      style: z.record(z.string(), z.unknown()).nullable().optional().describe('Text style object (text items only)'),
      verticalAlign: z.enum(['top', 'center', 'bottom']).nullable().optional().describe('Vertical alignment of text: top, center, bottom'),
      sequenceId,
    }),
    example: { type: 'setStyle', itemId: 'item_1', mode: 'pip', opacity: 0.8 },
  },
  {
    type: 'setText',
    family: 'styles',
    doc: [
      '- {"type":"setText","itemId","text"} or {"type":"setText","itemId","counter":{"mode":"countdown"|"countup","format"?:"s"|"mm:ss"|"hh:mm:ss"}}: changes the text of a text item, or turns it into a timer readout; give exactly one of the two.',
    ],
    schema: op('setText', {
      itemId: idOf('Text item ID'),
      text: z.string().optional().describe('New text; give exactly one of this and counter'),
      counter: z
        .object({
          mode: z.enum(['countdown', 'countup']).describe('countdown or countup'),
          format: z.enum(['s', 'mm:ss', 'hh:mm:ss']).optional().describe('s, mm:ss or hh:mm:ss'),
        })
        .optional()
        .describe('Turn it into a timer readout; give exactly one of this and text'),
      sequenceId,
    }),
    example: { type: 'setText', itemId: 'item_1', text: 'Chapter 1' },
  },
  {
    type: 'setAudioMix',
    family: 'styles',
    doc: [
      '- {"type":"setAudioMix","itemId","muted"?,"volume"?,"fadeIn"?:seconds,"fadeOut"?:seconds}: changes the sound of an audio, video or audible composition item; volume is a linear multiplier from 0 to 4, 1 being the original volume (0.5 is about -6 dB, 2 about +6 dB); a fade of 0 removes it.',
    ],
    schema: op('setAudioMix', {
      itemId: idOf('Audio, video or audible composition item ID'),
      muted: z.boolean().optional().describe('Muted'),
      volume: z.number().min(0).max(4).optional().describe('Linear multiplier, 0 to 4, 1 is the original volume'),
      fadeIn: seconds.optional().describe('Fade in (seconds); 0 removes it'),
      fadeOut: seconds.optional().describe('Fade out (seconds); 0 removes it'),
      sequenceId,
    }),
    example: { type: 'setAudioMix', itemId: 'item_1', volume: 0.5, fadeOut: 1 },
  },
  {
    type: 'setTransition',
    family: 'transitions-and-effects',
    doc: [
      '- {"type":"setTransition","leftItemId"?,"rightItemId"?,"kind","params"?,"duration"?:seconds,"easing"?,"placement"?,"audioCrossfade"?}: sets a transition. With both IDs it goes between two adjacent visual items on the same track; with only rightItemId it is that item\'s entrance, with only leftItemId its exit. kind: dissolve, wipe, slide, zoom, iris take no params and work one-sided or two-sided; dip-to-color (params {"color":"#RRGGBB"}) and push (params {"direction":"left"|"right"|"up"|"down"}) are two-sided only. easing: linear, ease-in, ease-out, ease-in-out; placement: center (default), start-at-cut, end-at-cut. An existing transition on the same edge is replaced. A two-sided transition requires duration, at most 10 seconds; fails when the media handles on either side of the cut are too short (TRANSITION_HANDLES_INSUFFICIENT, details give how many frames are missing): trim the items or shorten the transition first. A one-sided transition is always centered and cannot crossfade audio; its duration is 0.1-2 seconds, 0.5 seconds when not given; when the item gets shorter, the effective duration is capped at half the item length, listed in shortenedTransitions of the receipt. When a later move, trim or delete makes a transition invalid, the engine removes it and gives the reason in removedTransitions of the receipt.',
    ],
    schema: op('setTransition', {
      leftItemId: idOf('Item on the left (exiting)').optional(),
      rightItemId: idOf('Item on the right (entering)').optional(),
      kind: z
        .enum(['dissolve', 'wipe', 'slide', 'zoom', 'iris', 'dip-to-color', 'push'])
        .describe('dissolve, wipe, slide, zoom, iris; dip-to-color and push are two-sided only'),
      params: z.record(z.string(), z.unknown()).optional().describe('{"color"} for dip-to-color, {"direction"} for push'),
      duration: time.optional().describe('Duration; required for two-sided transitions, at most 10 seconds'),
      easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out']).optional().describe('linear, ease-in, ease-out, ease-in-out'),
      placement: z.enum(['center', 'start-at-cut', 'end-at-cut']).optional().describe('center (default), start-at-cut, end-at-cut'),
      audioCrossfade: z.boolean().optional().describe('Also crossfade the audio (two-sided only)'),
      ...timed,
    }),
    example: { type: 'setTransition', leftItemId: 'item_1', rightItemId: 'item_2', kind: 'dissolve', duration: 0.5 },
  },
  {
    type: 'removeTransition',
    family: 'transitions-and-effects',
    doc: ['- {"type":"removeTransition","transitionId"}: deletes a transition.'],
    schema: op('removeTransition', {
      transitionId: idOf('Transition ID'),
      sequenceId,
    }),
    example: { type: 'removeTransition', transitionId: 'transition_1' },
  },
  {
    type: 'setEffects',
    family: 'transitions-and-effects',
    doc: [
      '- {"type":"setEffects","itemId","fx":{…}|null}: replaces the effects (fx) of a video, image, sticker, placeholder, whiteboard or composition item as a whole; null removes them. Fields left out do not apply, so include existing ones you want to keep. Fields: brightness, exposure, contrast, saturation, temperature, hue (-1 to 1, 0 is unchanged; hue is multiplied by 180 degrees); grayscale, sharpen, noise, vignette (0 to 1); blur (0-100); filterPreset (none, calm1, calm2, calm3, clean1-3, cottage1-3, peckham1-3); effectPreset (none, invert, night_vision, thermal_vision, old, polaroid, filmic, snowy, box_blur, bokeh_blur) with effectIntensity (0 to 1); shadow {"offsetX","offsetY","blur","color","opacity"}; stroke {"width","color"}. All lengths are in pixels relative to a 540 short edge.',
    ],
    schema: op('setEffects', {
      itemId: idOf('Visual item ID'),
      fx: z.record(z.string(), z.unknown()).nullable().describe('Effects object that replaces the existing one as a whole; null removes it'),
      sequenceId,
    }),
    example: { type: 'setEffects', itemId: 'item_1', fx: { brightness: 0.1, saturation: -0.2 } },
  },
  {
    type: 'setChapters',
    family: 'chapters-and-ducking',
    doc: [
      '- {"type":"setChapters","chapters":[{"chapterId"?,"at":seconds,"title","summary"?,"thumbnail"?:"image asset ID"}]}: replaces the whole chapter list (strictly increasing in time; the first chapter is usually at 0). Chapters are pinned to moments on the timeline and do not move with items; cuts (addCuts, restoreCut) are the exception, where chapters move with the content.',
    ],
    schema: op('setChapters', {
      chapters: z
        .array(
          z.object({
            chapterId: idOf('Existing chapter ID to keep').optional(),
            at: time.describe('Chapter start time'),
            title: z.string().describe('Title'),
            summary: z.string().optional().describe('Summary'),
            thumbnail: idOf('Image asset ID for the thumbnail').optional(),
          }),
        )
        .describe('The complete chapter list, strictly increasing in time'),
      ...timed,
    }),
    example: {
      type: 'setChapters',
      chapters: [
        { at: 0, title: 'Intro' },
        { at: 42, title: 'Demo' },
      ],
    },
  },
  {
    type: 'upsertChapter',
    family: 'chapters-and-ducking',
    doc: [
      '- {"type":"upsertChapter","chapterId"?,"at"?:seconds,"title"?,"summary"?,"thumbnail"?}: creates a chapter (without chapterId; at and title are required) or changes one; null for summary or thumbnail removes it.',
    ],
    schema: op('upsertChapter', {
      chapterId: idOf('Chapter to change; a new one is created when omitted').optional(),
      at: time.optional().describe('Chapter start time; required when creating'),
      title: z.string().optional().describe('Title; required when creating'),
      summary: z.string().nullable().optional().describe('Summary; null removes it'),
      thumbnail: idOf('Image asset ID for the thumbnail').nullable().optional(),
      ...timed,
    }),
    example: { type: 'upsertChapter', at: 90, title: 'Summary' },
  },
  {
    type: 'removeChapter',
    family: 'chapters-and-ducking',
    doc: ['- {"type":"removeChapter","chapterId"}: deletes a chapter.'],
    schema: op('removeChapter', {
      chapterId: idOf('Chapter ID'),
      sequenceId,
    }),
    example: { type: 'removeChapter', chapterId: 'chapter_1' },
  },
  {
    type: 'setDucking',
    family: 'chapters-and-ducking',
    doc: [
      '- {"type":"setDucking","ruleId"?,"trigger":{"kind":"items","trackIds"?,"itemIds"?} or {"kind":"speech"},"target":{"trackIds"?,"itemIds"?},"depth"?,"attack"?:seconds,"release"?:seconds,"enabled"?,"name"?}: ducking, e.g. lowering the background music while a voice is heard. A trigger of kind items fires while these tracks and items sound; speech fires while someone is speaking (based on the transcript; this version does not duck for it yet). Without ruleId a rule is created (trigger and target required); with it, only the given fields change. depth is the reduction in dB, 0-60, default 10; attack defaults to 0.02 seconds, release to 0.35 seconds. The trigger and target groups must not overlap.',
    ],
    schema: op('setDucking', {
      ruleId: idOf('Rule to change; a new one is created when omitted').optional(),
      trigger: z
        .object({
          kind: z.enum(['items', 'speech']).describe('items (while these tracks and items sound) or speech (while someone speaks)'),
          trackIds: z.array(z.string()).optional().describe('Tracks for items'),
          itemIds: z.array(z.string()).optional().describe('Items for items'),
        })
        .optional()
        .describe('When to duck; required when creating'),
      target: z
        .object({
          trackIds: z.array(z.string()).optional().describe('Tracks to duck'),
          itemIds: z.array(z.string()).optional().describe('Items to duck'),
        })
        .optional()
        .describe('What to duck; required when creating'),
      depth: z.number().min(0).max(60).optional().describe('Reduction in dB, default 10'),
      attack: seconds.optional().describe('Time to duck down (seconds), default 0.02'),
      release: seconds.optional().describe('Time to recover (seconds), default 0.35'),
      enabled: z.boolean().optional().describe('Enabled'),
      name: z.string().optional().describe('Rule name'),
      sequenceId,
    }),
    example: {
      type: 'setDucking',
      trigger: { kind: 'items', trackIds: ['track_voice'] },
      target: { trackIds: ['track_music'] },
      depth: 12,
    },
  },
  {
    type: 'removeDucking',
    family: 'chapters-and-ducking',
    doc: ['- {"type":"removeDucking","ruleId"}: deletes a ducking rule.'],
    schema: op('removeDucking', {
      ruleId: idOf('Rule ID'),
      sequenceId,
    }),
    example: { type: 'removeDucking', ruleId: 'duck_1' },
  },
  {
    type: 'addCuts',
    family: 'speech',
    doc: [
      '- {"type":"addCuts","assetId":"ID of the asset being cut","cuts":[{"from":seconds,"to":seconds,"ref"?:"suggestion ID"}]}: speech editing: records removed source ranges in this asset\'s cut set (seconds on the asset\'s own clock, not timeline seconds) and re-lays out the timeline according to the cuts: video and audio items playing this asset are split at the cuts with the middle removed, and later content on their tracks moves earlier; items on other tracks that follow cuts (followPolicy follow-cuts, the default for new items; to pin one to the timeline, first switch it to sequence-fixed with updateItem) move and shorten along, and those falling entirely inside a removed range are deleted (removedByCuts in the receipt); chapters move earlier with the content, those inside a removed range move back to the cut, and chapters removed entirely are deleted. Cuts within 0.02 seconds of an existing cut are merged. The cut-set document is listed in the documents of the video (kind cut-set).',
    ],
    schema: op('addCuts', {
      assetId: idOf('ID of the asset being cut'),
      cuts: z
        .array(
          z.object({
            from: seconds.describe('Start on the asset clock (seconds, not timeline seconds)'),
            to: seconds.describe('End on the asset clock (seconds)'),
            ref: idOf('Origin: the ID of an edit suggestion').optional(),
          }),
        )
        .min(1)
        .describe('Source ranges to remove'),
      sequenceId,
    }),
    example: { type: 'addCuts', assetId: 'asset_1', cuts: [{ from: 3.2, to: 4.1 }] },
  },
  {
    type: 'restoreCut',
    family: 'speech',
    doc: [
      '- {"type":"restoreCut","assetId":"asset ID","cutId":"cut ID"}: restores a cut, putting the removed part back at the seam and moving later content and chapters later (a chapter right on the seam stays put); when the seam cannot be found, the cut is only removed from the cut set (cutsNotRelaid in the receipt).',
    ],
    schema: op('restoreCut', {
      assetId: idOf('Asset ID'),
      cutId: idOf('Cut ID'),
      sequenceId,
    }),
    example: { type: 'restoreCut', assetId: 'asset_1', cutId: 'cut_1' },
  },
  {
    type: 'proposeCuts',
    family: 'speech',
    doc: [
      // i18n-ignore: example Chinese and Vietnamese filler words from the zh and vi filler lists
      '- {"type":"proposeCuts","assetId":"asset ID","speechDocumentId"?,"detect"?:{"pauses"?,"fillers"?,"minPause"?:seconds,"compressTo"?:seconds,"maxGap"?:seconds,"fillerLanguage"?:"auto"|"en"|"zh"|"vi","customFillers"?:["word"],"trimChapterStarts"?}}: detects fillers in this asset\'s transcript (um, uh, Chinese 嗯 and 呃, Vietnamese ừm and ờ, etc., including soft fillers such as "you know", 就是 or "kiểu như là" that only count at phrase boundaries) and long pauses (by default, pauses of 0.8 seconds or more and under 3 seconds are compressed to 0.3 seconds, with 0.1 seconds extra kept at sentence ends), and writes them as an editorial proposal: a document of kind editorial-proposal in the documents of the video (one per asset, replaced as a whole when proposed again). Does not change the timeline; ranges already cut are not proposed again; when the asset has several transcripts, name one with speechDocumentId. Read the proposal with documents_read: each entry in suggestions has id, kind (filler or pause), the source range t0/t1 (in timescale ticks), text, reason and status. Repeated sentences are not detected.',
    ],
    schema: op('proposeCuts', {
      assetId: idOf('Asset ID'),
      speechDocumentId: idOf('Transcript to use; name one when the asset has several').optional(),
      detect: z
        .object({
          pauses: z.boolean().optional().describe('Detect long pauses, default true'),
          fillers: z.boolean().optional().describe('Detect fillers, default true'),
          minPause: seconds.optional().describe('Shortest pause (seconds), default 0.8'),
          compressTo: seconds.optional().describe('Compress pauses to (seconds), default 0.3'),
          maxGap: seconds.optional().describe('Longer gaps are not counted as pauses (seconds), default 3'),
          fillerLanguage: z.enum(['auto', 'en', 'zh', 'vi']).optional().describe('Filler list: auto (English, Chinese and Vietnamese, the default), en, zh or vi'),
          customFillers: z.array(z.string()).optional().describe('Additional words to treat as fillers'),
          trimChapterStarts: z.boolean().optional().describe('Also compress pauses between chapters'),
        })
        .optional()
        .describe('Detection parameters; defaults apply to those not given'),
    }),
    example: { type: 'proposeCuts', assetId: 'asset_1', detect: { minPause: 1 } },
  },
  {
    type: 'acceptCutSuggestions',
    family: 'speech',
    doc: [
      '- {"type":"acceptCutSuggestions","proposalId":"proposal document ID","suggestionIds":["suggestion ID"]}: accepts suggestions from a proposal and cuts their source ranges (like addCuts, with the suggestion ID as the cut ref); the suggestions are marked accepted, in one undoable transaction. Fails when the transcript changed after the proposal was made (details.rule is proposal-stale): run proposeCuts again first. To change a range, do not use this; use addCuts directly and put the suggestion ID in ref.',
    ],
    schema: op('acceptCutSuggestions', {
      proposalId: idOf('Proposal document ID'),
      suggestionIds: z.array(idOf('Suggestion ID')).min(1).describe('Suggestions to accept'),
      sequenceId,
    }),
    example: { type: 'acceptCutSuggestions', proposalId: 'doc_proposal_1', suggestionIds: ['s1', 's2'] },
  },
  {
    type: 'replaceCodeBundle',
    family: 'code',
    doc: [
      '- {"type":"replaceCodeBundle","itemId":"composition item ID","assetRef":{"id":"code bundle asset ID","revision"},"prerender"?:{"id":"prerender asset ID","revision"}|null,"parameterValues"?:{…}}: swaps, in place, the code bundle revision and prerender of a composition item (code graphic) on the timeline: the item ID, track, start, position and size, opacity, name, effects, mask, keyframes and sound all stay the same. The duration becomes that of the new prerender (or the intrinsic duration in the code bundle manifest when there is no prerender); a shorter one is trimmed, and a longer one that runs into the next item on the same track is rejected with TIMELINE_OVERLAP (moveItem it out of the way or deleteItems first). When the item has parameters and the new bundle drops or changes the parameter schema, give parameterValues too. impact.codeEdits in the receipt lists the replaced old revisions and the frame counts before and after. Usually not written by hand: it is the step compositions_import performs with replace; when its second edit fails, follow its next and finish it here.',
    ],
    schema: op('replaceCodeBundle', {
      itemId: idOf('Composition item to replace (type composition)'),
      assetRef: z
        .object({ id: idOf('Code bundle asset ID'), revision: z.string().describe('Asset revision') })
        .describe('The new code bundle asset revision (bundle.assetId and bundle.revision returned by compositions_import)'),
      prerender: z
        .object({ id: idOf('Prerender asset ID'), revision: z.string().describe('Asset revision') })
        .nullable()
        .optional()
        .describe('The new prerender (prerender.assetId and prerender.revision returned by compositions_import); null or omitted means no prerender'),
      parameterValues: z.record(z.string(), z.unknown()).optional().describe('Item parameters, replaced as a whole; the existing ones are kept when omitted'),
      sequenceId,
    }),
    example: {
      type: 'replaceCodeBundle',
      itemId: 'item_lower_third',
      assetRef: { id: 'asset_bundle_2', revision: '1' },
      prerender: { id: 'asset_prerender_2', revision: '1' },
    },
  },
  {
    type: 'addTrack',
    family: 'tracks-and-sequences',
    doc: ['- {"type":"addTrack","kind":"visual"|"audio","name"?}: adds a track.'],
    schema: op('addTrack', {
      kind: z.enum(['visual', 'audio']).describe('visual (picture) or audio (sound)'),
      name: z.string().optional().describe('Track name'),
      sequenceId,
    }),
    example: { type: 'addTrack', kind: 'audio', name: 'Background music' },
  },
  {
    type: 'deleteTrack',
    family: 'tracks-and-sequences',
    doc: [
      '- {"type":"deleteTrack","trackId"}: deletes an empty track; the order of the other tracks is unchanged. Rejected while the track still has items (details.itemIds lists them): deleteItems them or moveItem them to another track first, which can go in the same edit; also rejected while a ducking rule uses the track.',
    ],
    schema: op('deleteTrack', {
      trackId: idOf('Track ID'),
      sequenceId,
    }),
    example: { type: 'deleteTrack', trackId: 'track_2' },
  },
  {
    type: 'updateTrack',
    family: 'tracks-and-sequences',
    doc: ['- {"type":"updateTrack","trackId","locked"?,"visible"?,"muted"?,"name"?}: changes a track.'],
    schema: op('updateTrack', {
      trackId: idOf('Track ID'),
      locked: z.boolean().optional().describe('Locked'),
      visible: z.boolean().optional().describe('Visible'),
      muted: z.boolean().optional().describe('Muted'),
      name: z.string().optional().describe('Track name'),
      sequenceId,
    }),
    example: { type: 'updateTrack', trackId: 'track_1', muted: true },
  },
  {
    type: 'moveTrack',
    family: 'tracks-and-sequences',
    doc: [
      '- {"type":"moveTrack","trackId","target","position":"above"|"below"}: moves a track above or below another track of the same kind (target); its items move with it; tracks of other kinds stay put.',
    ],
    schema: op('moveTrack', {
      trackId: idOf('Track ID'),
      target: idOf('ID of the reference track of the same kind'),
      position: z.enum(['above', 'below']).describe('Place it above or below the reference track'),
      sequenceId,
    }),
    example: { type: 'moveTrack', trackId: 'track_2', target: 'track_1', position: 'below' },
  },
  {
    type: 'updateSequence',
    family: 'tracks-and-sequences',
    doc: [
      '- {"type":"updateSequence","name"?,"canvas"?:{"width","height"},"background"?:"#RRGGBB"}: changes the canvas size (pixels) and background color (an opaque solid color). Item positions are stored as percentages of the frame, so they follow the canvas when it is resized.',
    ],
    schema: op('updateSequence', {
      name: z.string().optional().describe('Sequence name'),
      canvas: z
        .object({ width: z.number().int().describe('Width (pixels)'), height: z.number().int().describe('Height (pixels)') })
        .optional()
        .describe('Canvas size'),
      background: z.string().optional().describe('Background color #RRGGBB'),
      sequenceId,
    }),
    example: { type: 'updateSequence', canvas: { width: 1080, height: 1920 } },
  },
  {
    type: 'putDocument',
    family: 'documents-and-versions',
    doc: [
      '- {"type":"putDocument","documentId"?,"kind","name"?,"language"?,"sourceAsset"?:{"assetId"},"sourceDocument"?:{"documentId"},"body":{…},"summary"?}: writes a new revision of a document (transcript, translation, etc.); body is the complete body object (read the current body with documents_read first, then change it); with documentId it changes that document (kind cannot change), without it a new one is created. Translations use kind "translation", with sourceDocument pointing to the document they translate. No new revision is created when the body is unchanged.',
    ],
    schema: op('putDocument', {
      documentId: idOf('Document to change; a new one is created when omitted').optional(),
      kind: z.string().describe('Document kind: speech (transcript), translation, etc.; cannot change for an existing document'),
      name: z.string().optional().describe('Document name'),
      language: z.string().optional().describe('Language (BCP 47); required for translations'),
      sourceAsset: z
        .object({ assetId: idOf('Asset ID') })
        .optional()
        .describe('Source asset (for a transcript)'),
      sourceDocument: z
        .object({ documentId: idOf('Document ID') })
        .optional()
        .describe('Source document (the transcript a translation is made from)'),
      body: z.record(z.string(), z.unknown()).describe('The complete body object (read the current body with documents_read first, then change it)'),
      summary: z.unknown().optional().describe('Document summary'),
    }),
    example: {
      type: 'putDocument',
      documentId: 'doc_speech_1',
      kind: 'speech',
      body: { schema: 'cuccut.speech/1', clock: 'source-asset', timescale: 1000, speakers: [], words: [], sentences: null, chapters: [] },
    },
  },
  {
    type: 'createCheckpoint',
    family: 'documents-and-versions',
    doc: ['- {"type":"createCheckpoint","name","note"?}: leaves a checkpoint in the history.'],
    schema: op('createCheckpoint', {
      name: z.string().describe('Checkpoint name'),
      note: z.string().optional().describe('Note'),
    }),
    example: { type: 'createCheckpoint', name: 'Rough cut done' },
  },
  {
    type: 'renameVideo',
    family: 'documents-and-versions',
    doc: ['- {"type":"renameVideo","name"}: renames the video (the folder name is not changed).'],
    schema: op('renameVideo', {
      name: z.string().describe('New video name (the folder name is not changed)'),
    }),
    example: { type: 'renameVideo', name: 'Launch event final cut' },
  },
];

/** Operation types `edits_apply` accepts, in the order of the table above. */
export const OPERATION_TYPES = EDIT_OPERATIONS.map((spec) => spec.type) as [string, ...string[]];

/** One entry of `edits_ops`: description, JSON Schema and example. */
export function describeOperation(spec: EditOperationSpec) {
  const { $schema: _, ...schema } = z.toJSONSchema(spec.schema, { io: 'input' }) as Record<string, unknown>;
  return {
    type: spec.type,
    family: spec.family,
    description: spec.doc.map((line) => line.replace(/^- /, '')).join('\n'),
    schema,
    example: spec.example,
  };
}
