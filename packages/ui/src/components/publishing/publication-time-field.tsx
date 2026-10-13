'use client';

import { useId, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Clock3 } from 'lucide-react';
import { calendarTime, dayInZone, formatCivilDate, intlLocale, resolveTimeField, resolveTimeFieldTimestamp, todayInZone } from '@cuccut/protocol';
import { cn } from 'cn';
import { Button } from '../../cc/ui/button';
import { Calendar } from '../../cc/ui/calendar';
import { DatePickerTrigger } from '../../cc/ui/date-picker';
import { Disclosure } from '../../cc/ui/disclosure';
import { Input } from '../../cc/ui/input';
import { Popover, PopoverContent } from '../../cc/ui/popover';
import { timezoneLabel } from '../../model/publishing-labels.ts';
import { PC } from './publishing-copy.ts';

/** An example of the exact-timestamp format (data, not copy). */
const TIMESTAMP_EXAMPLE = '2026-10-01T18:00:00-06:00';

/** The saved instant as the field shows it: the civil day and `HH:MM` in `timezone`, or nothing (also when the timezone is not valid). */
export function timeFieldParts(value: string | null, timezone: string): { day: string; time: string; today: string } | null {
  try {
    const today = todayInZone(timezone);
    return value ? { day: dayInZone(value, timezone), time: calendarTime(value, timezone), today } : { day: '', time: '', today };
  } catch {
    return null;
  }
}

/**
 * A publication time (design §2.4, port of agentcut `publication-time-field.tsx`): a date-picker trigger that opens a calendar, a time input and
 * "Apply time", plus an exact timestamp with its UTC offset behind a disclosure. The popover edits a draft; only Apply hands a validated instant to
 * `onChange` (local times that do not exist or happen twice are refused with the reason, never shifted). Clear sets null.
 */
export function PublicationTimeField({
  value,
  onChange,
  timezone,
  label,
  disabled,
  disabledReason,
  clearable = true,
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  timezone: string;
  label: string;
  disabled?: boolean;
  /** Why the field is disabled (shown under it; a disabled control says why). */
  disabledReason?: string;
  clearable?: boolean;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [error, setError] = useState('');
  const parts = timeFieldParts(value, timezone);
  const timezoneError = parts ? '' : PC.time.tzInvalid;
  const shown = parts?.day ? PC.time.summary(formatCivilDate(parts.day, intlLocale(), { month: 'short', day: 'numeric', year: 'numeric' }), parts.time) : PC.time.choose;

  const commit = (exact: boolean) => {
    if (disabled) return;
    try {
      onChange(exact ? resolveTimeFieldTimestamp(timestamp) : resolveTimeField(day, time, timezone, value));
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className={cn('min-w-0 space-y-1 text-sm', className)}>
      <label htmlFor={id}>{label}</label>
      <Popover
        open={open && !disabled}
        onOpenChange={(next) => {
          if (next) {
            setDay(parts?.day ?? '');
            setTime(parts?.time ?? '');
            setTimestamp(value ?? '');
            setError('');
          }
          setOpen(next);
        }}
      >
        <DatePickerTrigger id={id} label={label} disabled={disabled} aria-describedby={disabled && disabledReason ? `${id}-why` : undefined}>
          {shown}
        </DatePickerTrigger>
        <PopoverContent data-cc side="bottom" className="w-min max-w-[calc(100vw-1rem)] space-y-3" aria-label={label}>
          <Calendar
            mode="single"
            required
            selected={day ? parseISO(day) : undefined}
            defaultMonth={parseISO(parts?.day || parts?.today || format(new Date(), 'yyyy-MM-dd'))}
            today={parts?.today ? parseISO(parts.today) : undefined}
            autoFocus
            disabled={!!timezoneError || disabled}
            onSelect={(date) => {
              setDay(format(date, 'yyyy-MM-dd'));
              setError('');
            }}
          />
          <div className="space-y-3 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`${id}-time`} className="flex items-center gap-2 text-sm">
                <Clock3 className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                {PC.time.time}
              </label>
              <Input
                id={`${id}-time`}
                type="time"
                value={time}
                disabled={disabled || !!timezoneError}
                aria-invalid={!!error || undefined}
                aria-describedby={error || timezoneError ? `${id}-error` : undefined}
                className="w-32 scheme-dark tabular-nums"
                onChange={(e) => {
                  setTime(e.target.value);
                  setError('');
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{PC.time.allTimesIn(timezoneLabel(timezone))}</p>
            {error || timezoneError ? (
              <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
                {error || timezoneError}
              </p>
            ) : null}
            <div className="flex justify-between gap-2">
              {clearable ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled || !value}
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  {PC.time.clear}
                </Button>
              ) : null}
              <Button type="button" className="ms-auto" disabled={disabled || !!timezoneError} onClick={() => commit(false)}>
                {PC.time.apply}
              </Button>
            </div>
          </div>
          <Disclosure summary={PC.time.exact} variant="plain">
            <div className="space-y-2 pt-2">
              <label htmlFor={`${id}-timestamp`} className="text-xs text-muted-foreground">
                {PC.time.exactLabel}
              </label>
              <Input
                id={`${id}-timestamp`}
                value={timestamp}
                placeholder={TIMESTAMP_EXAMPLE}
                disabled={disabled}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className="tabular-nums"
                onChange={(e) => {
                  setTimestamp(e.target.value);
                  setError('');
                }}
              />
              <Button type="button" variant="outline" disabled={disabled} onClick={() => commit(true)}>
                {PC.time.applyExact}
              </Button>
            </div>
          </Disclosure>
        </PopoverContent>
      </Popover>
      {disabled && disabledReason ? (
        <p id={`${id}-why`} className="text-xs text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
