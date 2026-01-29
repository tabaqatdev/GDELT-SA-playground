import { useState, useEffect } from 'react';
import { Table } from 'apache-arrow';
import { useDuckDB } from '@/context/duckdb-context';
import { useAppState } from '@/context/app-state-context';

export function useEvents() {
  const { query, initialized, ftsEnabled } = useDuckDB();
  const { filters, selectedEventId } = useAppState();
  const [arrowTable, setArrowTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!initialized) return;

    const fetchEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        // Build WHERE clauses
        const whereClauses: string[] = [];

        // Time range
        whereClauses.push(`date BETWEEN ${filters.timeRange.start} AND ${filters.timeRange.end}`);

        // Sentiment filter (done in SQL now)
        const sentimentClauses: string[] = [];
        if (filters.sentiment.includes('positive')) {
          sentimentClauses.push('sentiment > 2');
        }
        if (filters.sentiment.includes('neutral')) {
          sentimentClauses.push('(sentiment >= -2 AND sentiment <= 2)');
        }
        if (filters.sentiment.includes('negative')) {
          sentimentClauses.push('sentiment < -2');
        }
        if (sentimentClauses.length > 0 && sentimentClauses.length < 3) {
          whereClauses.push(`(${sentimentClauses.join(' OR ')})`);
        }

        // BBox filter - Enhanced to keep arcs (source/target) and selected event visible
        if (filters.bbox) {
          const { south, north, west, east } = filters.bbox;
          // We construct a composite condition:
          // 1. Primary location is in BBox
          // 2. OR Actor 1 (Source) is in BBox
          // 3. OR Actor 2 (Target) is in BBox
          // 4. OR It is the currently selected event (ALWAYS keep visible)

          const inBBox = (latCol: string, lonCol: string) =>
            `(${latCol} BETWEEN ${south} AND ${north} AND ${lonCol} BETWEEN ${west} AND ${east})`;

          const conditions = [
            inBBox('lat', 'lon'),
            inBBox('actor1_lat', 'actor1_lon'),
            inBBox('actor2_lat', 'actor2_lon'),
          ];

          if (selectedEventId) {
            conditions.push(`id = '${selectedEventId}'`);
          }

          whereClauses.push(`(${conditions.join(' OR ')})`);
        }

        // Event types
        if (filters.eventTypes.length > 0 && filters.eventTypes.length < 4) {
          whereClauses.push(`eventType IN (${filters.eventTypes.join(',')})`);
        }

        // Countries
        if (filters.countries.length > 0) {
          const countryList = filters.countries.map((c) => `'${c}'`).join(',');
          whereClauses.push(`country IN (${countryList})`);
        }

        // Search query
        let useFTS = false;
        if (filters.searchQuery) {
          // Use FTS only if enabled in context
          // Otherwise fallback to ILIKE (which we need to add back if FTS is disabled)
          // But wait, my previous edit REMOVED the ILIKE clause.
          // So I must logic: if (!ftsEnabled) -> Add ILIKE. if (ftsEnabled) -> Do nothing here, query below.

          if (!ftsEnabled) {
            const searchTerm = filters.searchQuery.replace(/'/g, "''");
            whereClauses.push(`(title ILIKE '%${searchTerm}%' OR content ILIKE '%${searchTerm}%')`);
          } else {
            useFTS = true;
          }
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        let sql = '';

        if (useFTS && filters.searchQuery) {
          const searchTerm = filters.searchQuery.replace(/'/g, "''");
          // Optimized Search Query using the small 'search_index' table
          // This scans much less data than matching against the main 'events' view
          sql = `
             WITH search_matches AS (
                SELECT id 
                FROM search_index
                WHERE title ILIKE '%${searchTerm}%'
             )
             SELECT 
                events.id, date, title, content, author, url,
                sentiment, eventType, lat, lon,
                country, location, actor1, actor2, goldstein,
                actor1_lat, actor1_lon, actor1_location,
                actor2_lat, actor2_lon, actor2_location
             FROM events
             JOIN search_matches ON events.id = search_matches.id
             ${whereClause ? whereClause.replace(/^WHERE/, 'AND') : ''}
             ORDER BY date DESC
             LIMIT 1000
           `;
        } else {
          // Standard Query (or ILIKE fallback if added to whereClauses)
          sql = `
              SELECT
                id, date, title, content, author, url,
                sentiment, eventType, lat, lon,
                country, location, actor1, actor2, goldstein,
                actor1_lat, actor1_lon, actor1_location,
                actor2_lat, actor2_lon, actor2_location
              FROM events
              ${whereClause}
              ORDER BY date DESC, sentiment DESC
              LIMIT 500000
            `;
        }

        const result = await query(sql);

        // Store Arrow table directly - zero copy!
        setArrowTable(result);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [initialized, query, filters, ftsEnabled, selectedEventId]);

  return { arrowTable, loading, error };
}
