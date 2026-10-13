'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { formatCivilDate, intlLocale, isCivilDate } from '@cuccut/protocol';
import { Calendar } from '../../cc/ui/calendar';
import { DatePickerTrigger } from '../../cc/ui/date-picker';
import { Popover, PopoverContent } from '../../cc/ui/popover';
import { PC } from './publishing-copy.ts';

/**
 * A civil date (`YYYY-MM-DD` in the workspace timezone) chosen on a calendar. Like `cc/ui/date-picker`'s `DatePicker`, but the trigger reads the date
 * in the reader's language, and the value never passes through UTC.
 */
export function CivilDatePicker({
  value,
  onChange,
  label,
  today,
  id,
  disabled,
  className,
  align = 'start',
}: {
  value: string;
  onChange: (day: string) => void;
  label: string;
  today?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const valid = isCivilDate(value);
  const selected = valid ? parseISO(value) : undefined;
  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <DatePickerTrigger id={id} label={label} disabled={disabled} className={className}>
        {valid ? formatCivilDate(value, intlLocale(), { month: 'short', day: 'numeric', year: 'numeric' }) : PC.time.chooseDay}
      </DatePickerTrigger>
      <PopoverContent data-cc side="bottom" align={align} className="w-auto max-w-[calc(100vw-1rem)]" aria-label={label}>
        <Calendar
          mode="single"
          required
          selected={selected}
          defaultMonth={selected ?? (today ? parseISO(today) : undefined)}
          today={today ? parseISO(today) : undefined}
          autoFocus
          onSelect={(date) => {
            onChange(format(date, 'yyyy-MM-dd'));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
