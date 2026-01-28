import { useState, useEffect } from 'react';
import { useDuckDB } from '@/context/duckdb-context';

interface DateRange {
  minDate: number | null;
  maxDate: number | null;
  loading: boolean;
}

export function useDateRange(): DateRange {
  const { query, initialized } = useDuckDB();
  const [dateRange, setDateRange] = useState<DateRange>({
    minDate: null,
    maxDate: null,
    loading: true,
  });

  useEffect(() => {
    if (!initialized) return;

    const fetchDateRange = async () => {
      try {
        const result = await query('SELECT MIN(date) as min_date, MAX(date) as max_date FROM events');
        const row = result.get(0);
        
        if (row) {
          setDateRange({
            minDate: row.min_date as number,
            maxDate: row.max_date as number,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch date range:', error);
        // Fallback to default dates
        setDateRange({
          minDate: 20250119,
          maxDate: 20260127,
          loading: false,
        });
      }
    };

    fetchDateRange();
  }, [initialized, query]);

  return dateRange;
}
