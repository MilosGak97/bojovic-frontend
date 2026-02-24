import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock3 } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';

type PickerMode = 'date' | 'datetime';

type DateTimePickerProps = {
  mode?: PickerMode;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  triggerClassName?: string;
};

const TIME_STEP_MINUTES = 15;

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateInputValue = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toDateTimeInputValue = (date: Date): string =>
  `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const toTimeInputValue = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

const parseDateValue = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return isValidDate(parsed) ? parsed : null;
};

const parseDateTimeValue = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
};

const getRoundedNow = (): Date => {
  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  now.setSeconds(0, 0);
  if (roundedMinutes >= 60) {
    now.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    now.setMinutes(roundedMinutes, 0, 0);
  }
  return now;
};

const buildDateWithTime = (date: Date, time: string): Date => {
  const [hourRaw, minuteRaw] = time.split(':');
  const hours = Number(hourRaw);
  const minutes = Number(minuteRaw);
  const normalized = new Date(date);
  normalized.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return normalized;
};

const getDisplayLabel = (value: string, mode: PickerMode, placeholder: string): string => {
  if (!value) return placeholder;
  const parsed = mode === 'date' ? parseDateValue(value) : parseDateTimeValue(value);
  if (!parsed) return placeholder;
  if (mode === 'date') {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(parsed);
  }
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

const TIME_OPTIONS = Array.from({ length: (24 * 60) / TIME_STEP_MINUTES }, (_, index) => {
  const totalMinutes = index * TIME_STEP_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${pad(hours)}:${pad(minutes)}`;
  return { value, label: value };
});

export function DateTimePicker({
  mode = 'date',
  value,
  onChange,
  disabled = false,
  placeholder,
  triggerClassName,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const parsedValue = useMemo(
    () => (mode === 'date' ? parseDateValue(value) : parseDateTimeValue(value)),
    [mode, value],
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(parsedValue ?? undefined);
  const [selectedTime, setSelectedTime] = useState<string>(
    toTimeInputValue(parsedValue ?? getRoundedNow()),
  );

  useEffect(() => {
    setSelectedDate(parsedValue ?? undefined);
    if (mode === 'datetime') {
      setSelectedTime(toTimeInputValue(parsedValue ?? getRoundedNow()));
    }
  }, [mode, parsedValue]);

  const resolvedPlaceholder = placeholder ?? (mode === 'date' ? 'Select date' : 'Select date & time');
  const displayLabel = getDisplayLabel(value, mode, resolvedPlaceholder);

  const applyDate = (date: Date | undefined, timeOverride?: string) => {
    setSelectedDate(date);
    if (!date) {
      onChange('');
      return;
    }
    if (mode === 'date') {
      onChange(toDateInputValue(date));
      return;
    }
    const nextTime = timeOverride ?? selectedTime;
    const withTime = buildDateWithTime(date, nextTime);
    onChange(toDateTimeInputValue(withTime));
  };

  const handleQuickToday = () => {
    const today = new Date();
    if (mode === 'date') {
      applyDate(today);
      return;
    }
    const time = selectedDate ? selectedTime : toTimeInputValue(getRoundedNow());
    setSelectedTime(time);
    applyDate(today, time);
  };

  const handleQuickNow = () => {
    if (mode !== 'datetime') return;
    const now = getRoundedNow();
    const nextTime = toTimeInputValue(now);
    setSelectedTime(nextTime);
    applyDate(now, nextTime);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'mt-1 flex w-full items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
            triggerClassName,
          )}
        >
          <span className={cn('truncate text-left', !value && 'text-slate-400')}>{displayLabel}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="!w-fit !min-w-0 !p-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => applyDate(date)}
          className="p-2"
          classNames={{
            caption_label: 'text-sm font-semibold text-slate-800',
            day_selected:
              'bg-slate-900 text-white hover:bg-slate-800 hover:text-white focus:bg-slate-900 focus:text-white',
            day_today: 'bg-slate-100 text-slate-900',
          }}
        />

        {mode === 'datetime' && (
          <div className="border-t border-slate-200 px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Time (15 min)
            </p>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-slate-500" />
              <select
                value={selectedTime}
                onChange={(event) => {
                  const nextTime = event.target.value;
                  setSelectedTime(nextTime);
                  if (selectedDate) {
                    applyDate(selectedDate, nextTime);
                  }
                }}
                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleQuickToday}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Today
            </button>
            {mode === 'datetime' && (
              <button
                type="button"
                onClick={handleQuickNow}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Now
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => applyDate(undefined)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
