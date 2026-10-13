import { useState } from 'react';
import { Button, ButtonGroup, Content, Dialog, DialogContainer, Form, Heading, TextField } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { BRAND_NAME_MAX, normalizeColor } from '../../model/library-brand.ts';
import { ColorField } from './inspector-controls.tsx';
import { BRAND_COPY as IB } from './brand-copy.ts';

const colorRow = style({ display: 'flex', alignItems: 'end', gap: 8 });
const grow = style({ flexGrow: 1, minWidth: 0 });

/** The color offered first when creating a new brand color (the mockup's blue). */
const START = '#3B63FB';

/**
 * Create a new brand color: name and color value. The value can be picked with the swatch color panel, or typed directly as hex (`#RGB`, `#RRGGBB`, or `#RRGGBBAA` with opacity).
 * If the name is left empty, the color value is used as the name. When `onSubmit` returns false, the dialog stays open (the failure message is shown by it).
 * State lives outside the dialog: S2's Dialog renders its children in several slots.
 */
export function NewColorDialog({ onSubmit, onClose }: { onSubmit(name: string, value: string): Promise<boolean>; onClose(): void }) {
  const [name, setName] = useState('');
  const [text, setText] = useState(START);
  const [busy, setBusy] = useState(false);
  const value = normalizeColor(text);
  const submit = async () => {
    if (!value || busy) return;
    setBusy(true);
    try {
      if (await onSubmit(name.trim() || value, value)) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <DialogContainer onDismiss={onClose}>
      <Dialog size="S">
        {({ close }) => (
          <>
            <Heading slot="title">{IB.newBrandColor}</Heading>
            <Content>
              <Form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}>
                <TextField label={IB.name} value={name} onChange={setName} placeholder={IB.namePlaceholder} autoFocus maxLength={BRAND_NAME_MAX} />
                <div className={colorRow}>
                  <ColorField label={IB.color} value={value ?? START} fallback={START} onCommit={setText} />
                  <TextField
                    label={IB.colorValue}
                    value={text}
                    onChange={setText}
                    isInvalid={!value}
                    errorMessage={IB.colorValueError}
                    styles={grow}
                  />
                </div>
              </Form>
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={close}>
                {IB.cancel}
              </Button>
              <Button variant="accent" isDisabled={!value} isPending={busy} onPress={() => void submit()}>
                {IB.add}
              </Button>
            </ButtonGroup>
          </>
        )}
      </Dialog>
    </DialogContainer>
  );
}
