import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Clock3 } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';
import {
  addDaysToDateKey,
  formatInSerbia,
  getSerbiaNowDateKey,
  getSerbiaNowDateTimeInput,
} from '../../utils/serbia-time';

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

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

type ParsedDateValue = {
  year: number;
  month: number;
  day: number;
};

type ParsedDateTimeValue = ParsedDateValue & {
  hour: number;
  minute: number;
};

const parseDateValue = (value: string): ParsedDateValue | null => {
  if (!value) return null;
  const match = DATE_REGEX.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
};

const parseDateTimeValue = (value: string): ParsedDateTimeValue | null => {
  if (!value) return null;
  const match = DATETIME_REGEX.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }
  return { year, month, day, hour, minute };
};

const toCalendarDate = (parsed: ParsedDateValue): Date =>
  new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0);

const toDateInputValue = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toTimeInputValue = (hour: number, minute: number): string => `${pad(hour)}:${pad(minute)}`;

const getTimeFromDateTimeInput = (value: string): string => {
  const parsed = parseDateTimeValue(value);
  if (!parsed) return '00:00';
  return toTimeInputValue(parsed.hour, parsed.minute);
};

const getRoundedNowInput = (): string => {
  const rawNow = getSerbiaNowDateTimeInput();
  const parsed = parseDateTimeValue(rawNow);
  if (!parsed) return rawNow;

  const totalMinutes = parsed.hour * 60 + parsed.minute;
  let roundedMinutes = Math.ceil(totalMinutes / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  let dayKey = `${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)}`;

  if (roundedMinutes >= 24 * 60) {
    roundedMinutes -= 24 * 60;
    dayKey = addDaysToDateKey(dayKey, 1);
  }

  const hour = Math.floor(roundedMinutes / 60);
  const minute = roundedMinutes % 60;
  return `${dayKey}T${toTimeInputValue(hour, minute)}`;
};

const getDisplayLabel = (value: string, mode: PickerMode, placeholder: string): string => {
  if (!value) return placeholder;
  const parsed = mode === 'date' ? parseDateValue(value) : parseDateTimeValue(value);
  if (!parsed) return placeholder;
  if (mode === 'date') {
    return formatInSerbia(value, { dateStyle: 'medium' }, placeholder);
  }
  return formatInSerbia(value, { dateStyle: 'medium', timeStyle: 'short' }, placeholder);
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
  const parsedDateValue = useMemo(() => parseDateValue(value), [value]);
  const parsedDateTimeValue = useMemo(() => parseDateTimeValue(value), [value]);
  const parsedValue = mode === 'date' ? parsedDateValue : parsedDateTimeValue;
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    parsedValue ? toCalendarDate(parsedValue) : undefined,
  );
  const [selectedTime, setSelectedTime] = useState<string>(
    mode === 'datetime'
      ? getTimeFromDateTimeInput(value || getRoundedNowInput())
      : '00:00',
  );

  useEffect(() => {
    setSelectedDate(parsedValue ? toCalendarDate(parsedValue) : undefined);
    if (mode === 'datetime') {
      const nextTime = parsedDateTimeValue
        ? toTimeInputValue(parsedDateTimeValue.hour, parsedDateTimeValue.minute)
        : getTimeFromDateTimeInput(getRoundedNowInput());
      setSelectedTime(nextTime);
    }
  }, [mode, parsedDateTimeValue, parsedValue]);

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
    onChange(`${toDateInputValue(date)}T${nextTime}`);
  };

  const handleQuickToday = () => {
    const todayKey = getSerbiaNowDateKey();
    const parsedToday = parseDateValue(todayKey);
    if (!parsedToday) return;
    const today = toCalendarDate(parsedToday);
    if (mode === 'date') {
      applyDate(today);
      return;
    }
    const time = selectedDate ? selectedTime : getTimeFromDateTimeInput(getRoundedNowInput());
    setSelectedTime(time);
    applyDate(today, time);
  };

  const handleQuickNow = () => {
    if (mode !== 'datetime') return;
    const roundedNow = getRoundedNowInput();
    const parsedNow = parseDateTimeValue(roundedNow);
    if (!parsedNow) return;
    const nowDate = toCalendarDate(parsedNow);
    const nextTime = toTimeInputValue(parsedNow.hour, parsedNow.minute);
    setSelectedTime(nextTime);
    applyDate(nowDate, nextTime);
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
