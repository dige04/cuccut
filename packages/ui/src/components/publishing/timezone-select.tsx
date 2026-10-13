'use client';

import { useMemo } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { CheckIcon, ChevronDownIcon, Search } from 'lucide-react';
import { cn } from 'cn';
import { timezoneLabel, timezoneOffset, timezoneOptions } from '../../model/publishing-labels.ts';
import { PC } from './publishing-copy.ts';

/**
 * The workspace or publication timezone (design §2.4, open question 8): a searchable select over the IANA zones this runtime knows, never free text.
 * It looks like `cc/ui/select` (recessed field, glass popup) with a search field at the top of the popup; typing "york" or "new york" finds
 * `America/New_York`.
 */
export function TimezoneSelect({
  value,
  onChange,
  id,
  label,
  disabled,
  invalid,
  className,
}: {
  value: string;
  onChange: (timezone: string) => void;
  id?: string;
  /** Accessible name of the trigger when no visible `<label htmlFor>` points at it. */
  label?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const items = useMemo(() => timezoneOptions(value || undefined), [value]);
  return (
    <Combobox.Root<string>
      items={items}
      value={value || null}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      itemToStringLabel={(zone) => timezoneLabel(zone)}
      disabled={disabled}
    >
      <Combobox.Trigger
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-border bg-black/15 py-2 pr-2 pl-2.5 text-sm whitespace-nowrap shadow-(--field-shadow) transition-[border-color,box-shadow,background-color] duration-150 outline-none select-none hover:border-white/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 motion-reduce:transition-none',
          className,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate text-left', !value && 'text-muted-foreground')}>
          {value ? timezoneLabel(value) : PC.time.timezoneChoose}
        </span>
        <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="isolate z-50">
          <Combobox.Popup
            data-cc
            aria-label={label ?? PC.time.timezoneChoose}
            className="glass-surface relative isolate z-50 flex max-h-[min(24rem,var(--available-height))] w-(--anchor-width) max-w-(--available-width) min-w-64 origin-(--transform-origin) flex-col overflow-hidden rounded-2xl border border-transparent p-1 text-popover-foreground shadow-(--glass-shadow-raised) backdrop-blur-[var(--glass-blur)] backdrop-saturate-[1.6] duration-150 more-contrast:glass-flat more-contrast:border-foreground/60 more-contrast:bg-popover reduce-transparency:glass-flat reduce-transparency:bg-popover reduce-transparency:backdrop-blur-none motion-reduce:animate-none data-ending-style:opacity-0 data-starting-style:opacity-0"
          >
            <div className="relative p-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Combobox.Input
                placeholder={PC.time.timezoneSearch}
                aria-label={PC.time.timezoneSearch}
                className="h-9 w-full min-w-0 rounded-xl border border-border bg-black/15 py-1 pr-2.5 pl-8 text-sm shadow-(--field-shadow) outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <Combobox.Empty>
              <p className="px-2.5 py-3 text-sm text-muted-foreground">{PC.time.timezoneNone}</p>
            </Combobox.Empty>
            <Combobox.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 scroll-py-1 empty:p-0">
              {(zone: string) => (
                <Combobox.Item
                  key={zone}
                  value={zone}
                  className="relative flex w-full cursor-default items-center gap-2 rounded-xl py-2 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-white/12 data-highlighted:text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">{timezoneLabel(zone)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{timezoneOffset(zone)}</span>
                  <Combobox.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon aria-hidden className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
