import { useEffect, useRef, useState } from 'react';
import { ActionButton, Text, ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import Copy from '@react-spectrum/s2/icons/Copy';
import { T } from './thread-copy.ts';

/**
 * Copy button: by default only the icon is shown, and `label` is used for the tooltip and the screen reader name. With `showLabel`, the text is also drawn (the “Copy” in the turn footer).
 * For two seconds after copying, it shows “Copied”.
 */
export function CopyButton({ text, label, showLabel = false }: { text: string; label?: string; showLabel?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const current = copied ? T.copied : (label ?? T.copy);
  const onPress = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ToastQueue.negative(T.copyFailed, { timeout: 5000 });
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  if (showLabel)
    return (
      <ActionButton isQuiet size="XS" aria-label={current} onPress={onPress}>
        {copied ? <CheckmarkCircle /> : <Copy />}
        <Text>{copied ? T.copied : T.copy}</Text>
      </ActionButton>
    );
  return (
    <TooltipTrigger delay={400}>
      <ActionButton isQuiet size="XS" aria-label={current} onPress={onPress}>
        {copied ? <CheckmarkCircle /> : <Copy />}
      </ActionButton>
      <Tooltip>{current}</Tooltip>
    </TooltipTrigger>
  );
}
