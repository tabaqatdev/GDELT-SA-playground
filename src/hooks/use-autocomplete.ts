import { useState, useEffect } from 'react';
import { useDuckDB } from '@/context/duckdb-context';

export interface Suggestion {
  term: string;
  type: 'actor' | 'location' | 'city';
  frequency: number;
}

export function useAutocomplete(query: string) {
  const { query: runQuery, initialized } = useDuckDB();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialized || !query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    let active = true;
    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        // Simple prefix match on the keywords table
        // Limit to 10 results
        const sql = `
          SELECT term, type, frequency 
          FROM search_keywords 
          WHERE term ILIKE '${query.replace(/'/g, "''")}%' 
          ORDER BY frequency DESC 
          LIMIT 10
        `;
        
        const result = await runQuery(sql);
        const data: Suggestion[] = result.toArray().map((row) => ({
          term: row.term as string,
          type: row.type as 'actor' | 'location' | 'city',
          frequency: Number(row.frequency),
        }));

        if (active) {
          setSuggestions(data);
        }
      } catch (err) {
        console.error('Autocomplete failed:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const debounce = setTimeout(fetchSuggestions, 150);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [query, initialized, runQuery]);

  return { suggestions, loading };
}
