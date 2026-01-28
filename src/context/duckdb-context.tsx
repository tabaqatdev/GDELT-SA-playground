import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { Table } from 'apache-arrow';
import * as duckdbClient from '@/lib/duckdb-client';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface DuckDBContextValue {
  db: AsyncDuckDB | null;
  status: Status;
  error: Error | null;
  initialized: boolean;
  loading: boolean;
  query: (sql: string) => Promise<Table>;
  retry: () => void;
  ftsEnabled: boolean;
}

const DuckDBContext = createContext<DuckDBContextValue | null>(null);

// Global singleton to persist across HMR
let globalDB: AsyncDuckDB | null = null;

export function DuckDBProvider({ children }: { children: ReactNode }) {
  const [db, setDB] = useState<AsyncDuckDB | null>(globalDB);
  const [status, setStatus] = useState<Status>(globalDB ? 'ready' : 'idle');
  const [error, setError] = useState<Error | null>(null);
  const [ftsEnabled, setFtsEnabled] = useState(false);

  const initialize = async () => {
    if (globalDB) {
      setDB(globalDB);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      console.log('Initializing DuckDB...');
      const database = await duckdbClient.initializeDuckDB();

      console.log('Registering parquet file...');
      const parquetUrl = `${import.meta.env.BASE_URL}final_enriched.parquet`;
      console.log('Registering parquet file from:', parquetUrl);
      
      await duckdbClient.registerParquetFile(
        'final_enriched.parquet', // Alias in DuckDB
        parquetUrl                // Actual URL
      );

      console.log('Installing extensions...');
      // Install FTS extension for full-text search
      try {
        await duckdbClient.installExtension('fts');
        console.log('FTS extension installed');
      } catch (err) {
        console.warn('FTS extension failed to install:', err);
      }

      // Create a deduplicated view - parquet has many duplicate GLOBALEVENTID rows
      await duckdbClient.executeQuery(`
        CREATE OR REPLACE VIEW events AS
        WITH ranked_events AS (
          SELECT
            CAST(GLOBALEVENTID AS VARCHAR) as id,
            SQLDATE as date,
            ArticleTitle as title,
            ArticleContent as content,
            ArticleAuthor as author,
            SOURCEURL as url,
            AvgTone as sentiment,
            QuadClass as eventType,
            ActionGeo_Lat as lat,
            ActionGeo_Long as lon,
            ActionGeo_CountryCode as country,
            ActionGeo_FullName as location,
            Actor1Name as actor1,
            Actor2Name as actor2,
            Actor1Geo_Lat as actor1_lat,
            Actor1Geo_Long as actor1_lon,
            Actor1Geo_FullName as actor1_location,
            Actor2Geo_Lat as actor2_lat,
            Actor2Geo_Long as actor2_lon,
            Actor2Geo_FullName as actor2_location,
            GoldsteinScale as goldstein,
            Year as year,
            quality_score,
            ROW_NUMBER() OVER (
              PARTITION BY GLOBALEVENTID 
              ORDER BY quality_score DESC NULLS LAST, ArticleContentLength DESC NULLS LAST
            ) as row_num
          FROM read_parquet('final_enriched.parquet')
          WHERE ActionGeo_Lat IS NOT NULL
            AND ActionGeo_Long IS NOT NULL
            AND AvgTone IS NOT NULL
        )
        SELECT
          id, date, title, content, author, url, sentiment, eventType,
          lat, lon, country, location, actor1, actor2,
          actor1_lat, actor1_lon, actor1_location,
          actor2_lat, actor2_lon, actor2_location,
          goldstein, year, quality_score
        FROM ranked_events
        WHERE row_num = 1;
      `);

      // Standard Search Optimization
      // FTS causing WASM memory issues, so we optimize the standard search instead
      try {
        console.log('Optimizing search performance...');
        
        // Ensure clean state
        await duckdbClient.executeQuery(`DROP TABLE IF EXISTS search_index`);
        
        // Materialize title for fast scanning
        await duckdbClient.executeQuery(`
          CREATE TABLE search_index AS 
          SELECT id, title 
          FROM events
        `);

        // Create standard index on title to speed up ILIKE/contains
        // Note: DuckDB's ILIKE is already quite fast, but this helps valid queries
        // or we can use the text search capabilities without the FTS extension overhead
        // Actually, for broad ILIKE '%...%', a standard b-tree index doesn't help much.
        // But let's keep the table small (just id, title) to scan faster than the full parquet.
        
        setFtsEnabled(true); // Re-using this flag to indicate "Fast Search Table Available"
      } catch (err) {
        console.error('Search optimization failed:', err);
        setFtsEnabled(false);
      }

      // Create Autocomplete Keywords Table - Try this separately
      try {
        console.log('Creating keyword index...');
        
        // Ensure clean state
        await duckdbClient.executeQuery(`DROP TABLE IF EXISTS search_keywords`);
        
        await duckdbClient.executeQuery(`
          CREATE TABLE search_keywords AS
          SELECT * FROM (
            SELECT DISTINCT Actor1Name as term, 'actor' as type, COUNT(*) as frequency 
            FROM read_parquet('final_enriched.parquet') 
            WHERE Actor1Name IS NOT NULL 
            GROUP BY Actor1Name
            
            UNION ALL
            
            SELECT DISTINCT ActionGeo_FullName as term, 'location' as type, COUNT(*) as frequency 
            FROM read_parquet('final_enriched.parquet') 
            WHERE ActionGeo_FullName IS NOT NULL 
            GROUP BY ActionGeo_FullName
            
            UNION ALL
            
            SELECT DISTINCT NearestCity as term, 'city' as type, COUNT(*) as frequency 
            FROM read_parquet('final_enriched.parquet') 
            WHERE NearestCity IS NOT NULL 
            GROUP BY NearestCity
          ) t
          ORDER BY frequency DESC
        `);
      } catch (kwErr) {
        console.error('Keyword index creation failed:', kwErr);
        // We can live without autocomplete
      }

      console.log('DuckDB initialized successfully');
      globalDB = database;
      setDB(database);
      setStatus('ready');
    } catch (err) {
      console.error('DuckDB initialization failed:', err);
      setError(err as Error);
      setStatus('error');
    }
  };

  useEffect(() => {
    initialize();

    return () => {
      // Don't close on unmount to persist across HMR
    };
  }, []);

  const query = async (sql: string): Promise<Table> => {
    if (!db) {
      throw new Error('DuckDB not initialized');
    }
    return duckdbClient.executeQuery(sql);
  };

  const retry = () => {
    setStatus('idle');
    setError(null);
    initialize();
  };

  const value: DuckDBContextValue = {
    db,
    status,
    error,
    initialized: status === 'ready',
    loading: status === 'loading',
    query,
    retry,
    ftsEnabled,
  };

  return <DuckDBContext.Provider value={value}>{children}</DuckDBContext.Provider>;
}

export function useDuckDB() {
  const context = useContext(DuckDBContext);
  if (!context) {
    throw new Error('useDuckDB must be used within DuckDBProvider');
  }
  return context;
}
