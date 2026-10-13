'use client';

import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../cc/ui/select';

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * A select over a short list of options (port of agentcut `publishing-select.tsx`): the recessed field and glass menu of `cc/ui/select`, never a raw
 * `<select>`. `''` is an ordinary value (for "All accounts").
 */
export function PublishingSelect<T extends string>({
  value,
  options,
  onChange,
  id,
  label,
  disabled,
  className,
}: {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  id?: string;
  /** Accessible name when no visible `<label htmlFor>` points at the trigger. */
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      items={options.map((option) => ({ value: option.value, label: option.label }))}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} className={cn('w-full min-w-0', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent data-cc alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
