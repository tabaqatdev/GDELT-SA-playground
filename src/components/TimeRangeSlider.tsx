import { useState, useEffect } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { useAppState } from '@/context/app-state-context';
import { useTranslation, useLanguage } from '@/context/i18n-context';
import { useDateRange } from '@/hooks/use-date-range';
import { sqlDateToDate, dateToSQLDate, formatDate } from '@/lib/utils';

// Convert SQL date to day index
function sqlDateToDayIndex(sqlDate: number, minDate: number): number {
  const date = sqlDateToDate(sqlDate);
  const minDateObj = sqlDateToDate(minDate);
  return Math.floor((date.getTime() - minDateObj.getTime()) / (1000 * 60 * 60 * 24));
}

// Convert day index to SQL date
function dayIndexToSQLDate(dayIndex: number, minDate: number): number {
  const minDateObj = sqlDateToDate(minDate);
  const date = new Date(minDateObj.getTime() + dayIndex * 24 * 60 * 60 * 1000);
  return dateToSQLDate(date);
}

export function TimeRangeSlider() {
  const { filters, updateTimeRange } = useAppState();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { minDate, maxDate, loading: dateRangeLoading } = useDateRange();

  // Use fallback dates while loading or if query fails
  const effectiveMinDate = minDate || 20250119;
  const effectiveMaxDate = maxDate || 20260127;
  const maxDayIndex = sqlDateToDayIndex(effectiveMaxDate, effectiveMinDate);

  const [localRange, setLocalRange] = useState<[number, number]>([
    sqlDateToDayIndex(filters.timeRange.start, effectiveMinDate),
    sqlDateToDayIndex(filters.timeRange.end, effectiveMinDate),
  ]);

  // Sync effect: When real data range loads, update filters if they are currently default or invalid
  useEffect(() => {
    if (!dateRangeLoading && minDate && maxDate) {
      const DEFAULT_START = 20250119;
      const DEFAULT_END = 20260127;
      
      const isDefault = filters.timeRange.start === DEFAULT_START && filters.timeRange.end === DEFAULT_END;
      const isOutOfBounds = filters.timeRange.start < minDate || filters.timeRange.end > maxDate;
      const isReversed = filters.timeRange.start > filters.timeRange.end;

      if (isDefault || isOutOfBounds || isReversed) {
        console.log('Syncing time range to data:', minDate, maxDate);
        updateTimeRange({ start: minDate, end: maxDate });
        setLocalRange([0, sqlDateToDayIndex(maxDate, minDate)]);
      } else {
        // Even if we don't change the filter, we MUST re-calculate localRange 
        // because effectiveMinDate has changed from fallback to real minDate.
        // The current localRange (day indices) was calculated against the fallback date.
        setLocalRange([
            sqlDateToDayIndex(filters.timeRange.start, minDate),
            sqlDateToDayIndex(filters.timeRange.end, minDate)
        ]);
      }
    }
  }, [minDate, maxDate, dateRangeLoading, updateTimeRange]); // Removed filters.timeRange to avoid loops, explicit checks inside

  // Debounce: only update filters after user stops sliding
  useEffect(() => {
    const timer = setTimeout(() => {
      // Guard against NaN
      if (!localRange || typeof localRange[0] !== 'number' || typeof localRange[1] !== 'number') return;

      const startSQL = dayIndexToSQLDate(localRange[0], effectiveMinDate);
      const endSQL = dayIndexToSQLDate(localRange[1], effectiveMinDate);

      if (startSQL && endSQL && (startSQL !== filters.timeRange.start || endSQL !== filters.timeRange.end)) {
        updateTimeRange({ start: startSQL, end: endSQL });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localRange, effectiveMinDate, updateTimeRange]); // removed filters.timeRange to break loop dependency

  const startDate = sqlDateToDate(dayIndexToSQLDate(localRange[0]!, effectiveMinDate));
  const endDate = sqlDateToDate(dayIndexToSQLDate(localRange[1]!, effectiveMinDate));

  if (dateRangeLoading) {
    return null; // Or a skeleton loader
  }

  return (
    <div className="absolute bottom-4 sm:bottom-20 left-2 right-2 sm:left-4 sm:right-auto sm:w-full sm:max-w-3xl z-10 rounded-lg border bg-background/95 p-3 sm:p-6 shadow-2xl backdrop-blur supports-backdrop-filter:bg-background/90 rtl:sm:left-auto rtl:sm:right-4">
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-semibold">{t('timeline.title')}</h3>
        <div className="flex gap-1 sm:gap-2 text-xs flex-wrap">
          <button
            onClick={() => setLocalRange([maxDayIndex - 7, maxDayIndex])}
            className="rounded bg-secondary px-2 py-1 hover:bg-secondary/80 whitespace-nowrap"
          >
            {t('timeline.presets.last7')}
          </button>
          <button
            onClick={() => setLocalRange([maxDayIndex - 30, maxDayIndex])}
            className="rounded bg-secondary px-2 py-1 hover:bg-secondary/80 whitespace-nowrap"
          >
            {t('timeline.presets.last30')}
          </button>
          <button
            onClick={() => setLocalRange([0, maxDayIndex])}
            className="rounded bg-secondary px-2 py-1 hover:bg-secondary/80 whitespace-nowrap"
          >
            {t('timeline.presets.all')}
          </button>
        </div>
      </div>

      <Slider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        value={localRange}
        onValueChange={(value) => setLocalRange(value as [number, number])}
        min={0}
        max={maxDayIndex}
        step={1}
        minStepsBetweenThumbs={1}
      >
        <Slider.Track className="relative h-2 grow rounded-full bg-secondary">
          <Slider.Range className="absolute h-full rounded-full bg-primary" />
        </Slider.Track>
        <Slider.Thumb
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-md transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Start date"
        />
        <Slider.Thumb
          className="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow-md transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="End date"
        />
      </Slider.Root>

      <div className="mt-4 flex justify-between text-sm">
        <div>
          <span className="text-muted-foreground">{t('timeline.start')}: </span>
          <span className="font-medium">{formatDate(startDate, language)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('timeline.end')}: </span>
          <span className="font-medium">{formatDate(endDate, language)}</span>
        </div>
      </div>
    </div>
  );
}
