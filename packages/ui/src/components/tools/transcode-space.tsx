import type { Id } from '@cuccut/protocol';
import { KIND_LABEL } from '../../model/space.ts';
import { addEntryInput, entryIdOfInput, fileName } from '../../model/tools-transcode.ts';
import type { FileVideoToolId } from '../../model/tool-catalog.ts';
import { useSpace } from '../../state/space-store.ts';
import { SpacePicker } from './tool-video-picker.tsx';
import { TRANSCODE_COPY } from './tools-copy.ts';

/*
 * Space inputs for compress, merge and extract audio (architecture design §7.9, “Space 条目作输入” (Space entries as inputs)): list items are recorded as `space:<entryId>`; here they get names, and the “从 Space 添加…” (Add from Space…) picker is drawn: choosing one appends it to the end of the list.
 */

export interface InputName {
  name: string;
  sub: string;
}

/** Name and second line of a list item: for local files, the file name and full path; for Space entries, the entry name and “Space · 种类” (Space · kind). */
export function useInputName(): (input: string) => InputName {
  const entries = useSpace((s) => s.entries);
  return (input) => {
    const entryId = entryIdOfInput(input);
    if (!entryId) return { name: fileName(input), sub: input };
    const entry = entries.find((e) => e.id === entryId);
    return entry ? { name: entry.name, sub: TRANSCODE_COPY.spaceItem(KIND_LABEL[entry.kind]) } : { name: entryId, sub: TRANSCODE_COPY.spaceGone };
  };
}

/** Adds an entry picked from Space to the list: entries already added are not added again. */
export function SpaceInputs({
  tool,
  inputs,
  onChange,
}: {
  tool: FileVideoToolId;
  inputs: readonly string[];
  onChange: (inputs: string[]) => void;
}) {
  const last = [...inputs].reverse().map(entryIdOfInput).find((id): id is Id => !!id) ?? null;
  return <SpacePicker tool={tool} data={null} value={last} onChange={(entryId) => onChange(addEntryInput(inputs, entryId))} />;
}
