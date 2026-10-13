import type { ReactNode } from 'react';
import { Button, Header, Heading, Picker, PickerItem, PickerSection, Text } from '@react-spectrum/s2';
import Checkmark from '@react-spectrum/s2/icons/Checkmark';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { ToolModelOption } from '../../model/tools-models.ts';
import { Gate } from './tool-parts.tsx';
import { GATE_COPY } from './tools-copy.ts';

/*
 * The “Model” section of a tool page (design file tool-tts.jsx `ModelLine`, image-gen.jsx `ModelLine` and `EngineGate`):
 * a model Picker grouped by provider, whether it is connected, and what this model can do; when the selected one cannot be used, a gate card is shown below.
 */

const line = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4, minHeight: 32, minWidth: 0 });
const state = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
  font: 'ui-xs',
  color: { default: 'gray-600', isOk: 'green-1000' },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const facts = style({
  flexGrow: 1,
  flexBasis: 0,
  minWidth: 160,
  font: 'ui-sm',
  color: 'gray-700',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

interface ProviderGroup<M> {
  providerId: string;
  provider: string;
  items: ToolModelOption<M>[];
}

function groups<M>(options: readonly ToolModelOption<M>[], localGroup: string): ProviderGroup<M>[] {
  const out: ProviderGroup<M>[] = [];
  for (const o of options) {
    const g = out.find((x) => x.providerId === o.providerId);
    if (g) g.items.push(o);
    else out.push({ providerId: o.providerId, provider: o.local ? localGroup : o.provider, items: [o] });
  }
  return out;
}

/**
 * The two lines of one menu item: for a cloud model, the model ID, with the reason it cannot be used or the model name below; for a local model, the model name, and when it is not installed, the reason and where to install it below
 * (the local group of design file image-gen.jsx `ModelLine`).
 */
function itemText<M>(o: ToolModelOption<M>): { label: string; description: string | null } {
  if (o.local) return { label: o.label, description: o.why ? GATE_COPY.localWhere(o.why) : null };
  return { label: o.modelId, description: o.why || o.label !== o.modelId ? (o.why ?? o.label) : null };
}

/** The model row: Picker (grouped by provider; providers not connected are marked “Not connected”; local models form their own group), status, and one line on capability. */
export function ModelLine<M>({
  label,
  options,
  selected,
  onSelect,
  factsOf,
  disableUnusable = false,
}: {
  label: string;
  options: readonly ToolModelOption<M>[];
  selected: ToolModelOption<M> | null;
  onSelect: (option: ToolModelOption<M>) => void;
  factsOf: (option: ToolModelOption<M>) => string;
  /** Models that are not connected cannot be selected (the menu in design file image-gen.jsx); speech follows the engine card's look, and a gate card appears after selection. A local model that is not installed can still be selected, and selecting it shows a download card. */
  disableUnusable?: boolean;
}) {
  const disabled = disableUnusable ? options.filter((o) => !o.usable && !o.local && o.key !== selected?.key).map((o) => o.key) : [];
  return (
    <div className={line}>
      <Picker
        aria-label={label}
        size="S"
        menuWidth={320}
        selectedKey={selected?.key ?? null}
        disabledKeys={disabled}
        onSelectionChange={(key) => {
          const next = options.find((o) => o.key === key);
          if (next && next.key !== selected?.key) onSelect(next);
        }}>
        {groups(options, GATE_COPY.localGroup).map((g) => (
          <PickerSection key={g.providerId} id={`provider:${g.providerId}`}>
            <Header>
              <Heading>{g.provider}</Heading>
            </Header>
            {g.items.map((o) => {
              const text = itemText(o);
              return (
                <PickerItem key={o.key} id={o.key} textValue={`${o.provider} · ${text.label}`}>
                  <Text slot="label">{text.label}</Text>
                  {text.description ? <Text slot="description">{text.description}</Text> : null}
                </PickerItem>
              );
            })}
          </PickerSection>
        ))}
      </Picker>
      {selected ? (
        <span className={state({ isOk: selected.usable })}>
          {selected.usable ? <Checkmark aria-hidden /> : null}
          {selected.usable ? (selected.local ? GATE_COPY.installed : GATE_COPY.connected) : selected.why}
        </span>
      ) : null}
      {selected ? (
        <span className={facts} title={factsOf(selected)}>
          {factsOf(selected)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Gate card when the selected model cannot be used (the cloud branch of design file image-gen.jsx `EngineGate`): if it is not connected, it says “Connect X first” and offers “Connect”;
 * if another usable one exists, it offers “Switch to an available …”. Gate cards for local models (download, platform not available) are in local-model-gate.tsx.
 * The gate's buttons stay neutral: the form's own submit is the view's one yellow.
 */
export function ModelGate<M>({
  selected,
  options,
  body,
  onConnect,
  onSwitch,
}: {
  selected: ToolModelOption<M> | null;
  options: readonly ToolModelOption<M>[];
  body: string;
  onConnect: () => void;
  onSwitch: (option: ToolModelOption<M>) => void;
}): ReactNode {
  if (!selected || selected.usable || selected.local) return null;
  // The fallback only goes to the cloud (the `preferred` of design file `EngineGate`): it does not switch the user to a local model on their behalf.
  const usable = options.filter((o) => o.usable && !o.local);
  const alt = usable.find((o) => o.providerId !== selected.providerId) ?? usable[0];
  const switchButton = alt ? (
    <Button variant="secondary" size="S" onPress={() => onSwitch(alt)}>
      {GATE_COPY.switchTo(`${alt.provider} · ${alt.modelId}`)}
    </Button>
  ) : null;
  if (!selected.connected) {
    return (
      <Gate
        title={GATE_COPY.connect(selected.provider)}
        body={body}
        actions={
          <>
            <Button variant="secondary" size="S" onPress={onConnect}>
              {GATE_COPY.goConnect}
            </Button>
            {switchButton}
          </>
        }
      />
    );
  }
  return <Gate title={GATE_COPY.unavailable(selected.provider)} body={selected.why ?? ''} actions={switchButton} />;
}
