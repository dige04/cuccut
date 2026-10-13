import type { ComponentProps } from 'react';
import { Header, Heading, Picker, PickerItem, PickerSection, Text } from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import Microphone from '@react-spectrum/s2/icons/Microphone';
import type { MyVoices, SpeechOption, TtsDraft, VoiceKey } from '../model/tools-tts.ts';
import { CLONE_NEW, pickerSelection, voicePickerGroups, type VoicePickerItem } from '../model/voice-picker.ts';
import { useShell } from '../state/shell-store.ts';
import { S } from './shell-copy.ts';

/**
 * The shared voice picker (design mockup voice-picker.jsx `VoicePicker`): used by both the tool page's “generate speech” and the editor's “audio › generate speech / clone voice”.
 * Grouping and greyed-out reasons are in model/voice-picker.ts; this file only draws. “clone new voice…” goes to 模型 › 语音合成 › 我的声音 (Models › Speech synthesis › My voices), where cloning is created; this version has no return hand-off, so the voice is picked after it is created. The manual voice-ID input and the line under the control are placed by the caller in its own layout.
 */
export function VoicePicker({
  label,
  draft,
  option,
  voices,
  onChange,
  styles,
}: {
  label: string;
  draft: Pick<TtsDraft, 'voice'>;
  option: SpeechOption;
  /** My voices; null until read. */
  voices: MyVoices;
  onChange: (voice: VoiceKey) => void;
  styles?: ComponentProps<typeof Picker>['styles'];
}) {
  const go = useShell((s) => s.go);
  const groups = voicePickerGroups(option, voices);
  const disabled = groups.flatMap((g) => g.items.filter((i) => i.disabled).map((i) => i.key));
  return (
    <Picker
      aria-label={label}
      size="S"
      styles={styles}
      menuWidth={320}
      placeholder={S.voicePicker.placeholder}
      selectedKey={pickerSelection(draft, option, voices)}
      disabledKeys={disabled}
      onSelectionChange={(key) => {
        if (key === null) return;
        if (key === CLONE_NEW) go({ tab: 'models', category: 'tts', page: 'voices' });
        else onChange(String(key) as VoiceKey);
      }}>
      {groups.map((g) =>
        g.title ? (
          <PickerSection key={g.id} id={`group:${g.id}`}>
            <Header>
              <Heading>{g.title}</Heading>
            </Header>
            {g.items.map((item) => voiceItem(item, g.id === 'mine'))}
          </PickerSection>
        ) : (
          g.items.map((item) => voiceItem(item, false))
        ),
      )}
    </Picker>
  );
}

function voiceItem(item: VoicePickerItem, mine: boolean) {
  return (
    <PickerItem key={item.key} id={item.key} textValue={item.label}>
      {item.key === CLONE_NEW ? <Add /> : mine && item.key.startsWith('library:') ? <Microphone /> : null}
      <Text slot="label">{item.label}</Text>
      {item.description ? <Text slot="description">{item.description}</Text> : null}
    </PickerItem>
  );
}
