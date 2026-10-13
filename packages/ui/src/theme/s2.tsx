/**
 * CucCut's face for Spectrum 2.
 *
 * The renderer builds alias `@react-spectrum/s2` to this module (`tools/cuccut-theme.ts` → `s2ThemeAlias`), so every
 * `import { Button } from '@react-spectrum/s2'` in the UI gets these wrappers and everything else unchanged.
 * The wrappers only add class hooks (`cc-*`); the look lives in `theme/cuccut.css`, which is unlayered and therefore
 * wins over S2's layered atomic classes. That is how agentcut's Liquid Glass control language (one yellow tint per
 * view, neutral capsules everywhere else, recessed fields, glass menus, solid dialogs) reaches components S2 compiles
 * ahead of time.
 *
 * Only components whose look depends on a prop (a variant, a fill style) or whose DOM has no stable hook of its own
 * are wrapped. Popovers, menus, list boxes, dialogs, tooltips, toasts, fields, tabs and progress indicators are
 * reached from `cuccut.css` through React Aria's own attributes (`data-trigger`, `role`, `data-rac`).
 */
import { forwardRef, type ComponentProps, type ElementType, type ForwardedRef } from 'react';
import {
  ActionButton as S2ActionButton,
  AlertDialog as S2AlertDialog,
  Badge as S2Badge,
  Button as S2Button,
  Checkbox as S2Checkbox,
  InlineAlert as S2InlineAlert,
  LinkButton as S2LinkButton,
  Picker as S2Picker,
  Radio as S2Radio,
  SegmentedControl as S2SegmentedControl,
  Slider as S2Slider,
  Switch as S2Switch,
  ToggleButton as S2ToggleButton,
} from '@react-spectrum/s2/index';

export * from '@react-spectrum/s2/index';

type ButtonProps = ComponentProps<typeof S2Button>;
type LinkButtonProps = ComponentProps<typeof S2LinkButton>;
type ActionButtonProps = ComponentProps<typeof S2ActionButton>;
type ToggleButtonProps = ComponentProps<typeof S2ToggleButton>;
type BadgeProps = ComponentProps<typeof S2Badge>;
type InlineAlertProps = ComponentProps<typeof S2InlineAlert>;
type AlertDialogProps = ComponentProps<typeof S2AlertDialog>;

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

/**
 * A wrapper that only adds a class hook. The cast keeps the wrapped component's own (often generic) signature, so
 * call sites type-check exactly as they did against S2.
 */
function hooked<C extends (...args: never[]) => unknown>(Component: C, name: string, hook: string): C {
  const Hooked = forwardRef(function Hooked(props: { UNSAFE_className?: string }, ref: ForwardedRef<unknown>) {
    const Inner = Component as unknown as ElementType;
    return <Inner {...props} ref={ref} UNSAFE_className={join(hook, props.UNSAFE_className)} />;
  });
  Hooked.displayName = name;
  return Hooked as unknown as C;
}

/** Status chips: neutral or a quiet tint of their colour, never the yellow accent (agentcut badge.tsx). */
export const Badge = forwardRef(function Badge(props: BadgeProps, ref: ForwardedRef<unknown>) {
  return (
    <S2Badge
      {...props}
      ref={ref as never}
      UNSAFE_className={join('cc-badge', `cc-badge-${props.variant ?? 'neutral'}`, props.UNSAFE_className)}
    />
  );
});

/** Inline alerts are solid content cards with a quiet tint, not bordered banners. */
export const InlineAlert = forwardRef(function InlineAlert(props: InlineAlertProps, ref: ForwardedRef<unknown>) {
  return (
    <S2InlineAlert
      {...props}
      ref={ref as never}
      UNSAFE_className={join('cc-inline-alert', `cc-alert-${props.variant ?? 'neutral'}`, props.UNSAFE_className)}
    />
  );
});

/**
 * Alert dialogs draw their own S2 buttons; the variant class lets `cuccut.css` give the confirm button the yellow
 * tint (confirmation), the quiet red fill (destructive) or a neutral capsule (the rest).
 */
export const AlertDialog = forwardRef(function AlertDialog(props: AlertDialogProps, ref: ForwardedRef<unknown>) {
  return (
    <S2AlertDialog
      {...props}
      ref={ref as never}
      UNSAFE_className={join('cc-ad', `cc-ad-${props.variant ?? 'confirmation'}`, props.UNSAFE_className)}
    />
  );
});

export const Picker = hooked(S2Picker, 'Picker', 'cc-picker');
export const SegmentedControl = hooked(S2SegmentedControl, 'SegmentedControl', 'cc-segmented');
export const Switch = hooked(S2Switch, 'Switch', 'cc-switch');
export const Checkbox = hooked(S2Checkbox, 'Checkbox', 'cc-checkbox');
export const Radio = hooked(S2Radio, 'Radio', 'cc-radio');
export const Slider = hooked(S2Slider, 'Slider', 'cc-slider');
