/**
 * CucCut's face for Spectrum 2.
 *
 * The renderer builds alias `@react-spectrum/s2` to this module (`tools/cuccut-theme.ts` → `s2ThemeAlias`), so every
 * `import { Button } from '@react-spectrum/s2'` in the UI gets these wrappers and everything else unchanged.
 * The wrappers only add class hooks (`cc-*`); the look lives in `theme/cuccut.css`, which is unlayered and therefore
 * wins over S2's layered atomic classes. That is how agentcut's Liquid Glass button language (one yellow tint per
 * view, neutral capsules everywhere else) reaches components S2 compiles ahead of time.
 */
import { forwardRef, type ComponentProps, type ForwardedRef } from 'react';
import {
  ActionButton as S2ActionButton,
  Button as S2Button,
  LinkButton as S2LinkButton,
  ToggleButton as S2ToggleButton,
} from '@react-spectrum/s2/index';

export * from '@react-spectrum/s2/index';

type ButtonProps = ComponentProps<typeof S2Button>;
type LinkButtonProps = ComponentProps<typeof S2LinkButton>;
type ActionButtonProps = ComponentProps<typeof S2ActionButton>;
type ToggleButtonProps = ComponentProps<typeof S2ToggleButton>;

function join(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}

function buttonClass(variant: string | undefined, fillStyle: string | undefined, extra: string | undefined): string {
  return join('cc-btn', `cc-btn-${variant ?? 'primary'}`, `cc-fill-${fillStyle ?? 'fill'}`, extra);
}

export const Button = forwardRef(function Button(props: ButtonProps, ref: ForwardedRef<unknown>) {
  return (
    <S2Button
      {...props}
      ref={ref as never}
      UNSAFE_className={buttonClass(props.variant, props.fillStyle, props.UNSAFE_className)}
    />
  );
});

export const LinkButton = forwardRef(function LinkButton(props: LinkButtonProps, ref: ForwardedRef<unknown>) {
  return (
    <S2LinkButton
      {...props}
      ref={ref as never}
      UNSAFE_className={buttonClass(props.variant, props.fillStyle, props.UNSAFE_className)}
    />
  );
});

export const ActionButton = forwardRef(function ActionButton(props: ActionButtonProps, ref: ForwardedRef<unknown>) {
  return (
    <S2ActionButton
      {...props}
      ref={ref as never}
      UNSAFE_className={join('cc-action', props.isQuiet && 'cc-quiet', props.UNSAFE_className)}
    />
  );
});

export const ToggleButton = forwardRef(function ToggleButton(props: ToggleButtonProps, ref: ForwardedRef<unknown>) {
  return (
    <S2ToggleButton
      {...props}
      ref={ref as never}
      UNSAFE_className={join('cc-action', 'cc-toggle', props.isQuiet && 'cc-quiet', props.UNSAFE_className)}
    />
  );
});
