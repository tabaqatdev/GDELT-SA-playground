# GDELT Saudi Arabia News Panel - Architecture

## Overview

A browser-based news analysis playground for GDELT dataset using DuckDB-WASM, Apache Arrow, MapLibre GL, and Deck.gl. Zero backend, all processing in-browser.

## System Architecture

```mermaid
graph TB
    subgraph "Browser Runtime"
        subgraph "UI Layer"
            Header[Header Component<br/>Theme/Lang Toggle]
            Map[MapLibre + Deck.gl<br/>Geospatial Viz]
            TimeSlider[Time Range Slider<br/>Temporal Filter]
            NewsList[News Panel<br/>Article Cards]
            Filters[Filter Controls<br/>Sentiment/Event Type]
        end

        subgraph "State Management"
            Context[React Context<br/>DuckDB/App State]
            TimeState[Time Range State]
            SelectionState[Selection State<br/>Map ↔ List]
            FilterState[Filter State<br/>Cross-filtering]
        end

        subgraph "Data Layer"
            DuckDB[DuckDB-WASM<br/>SQL Engine]
            Arrow[Apache Arrow<br/>Zero-copy Data]
            FTS[Full-Text Search<br/>FTS Extension]
            VSS[Vector Search<br/>VSS Extension]
            Cache[Query Cache<br/>LRU Memory]
        end

        subgraph "Data Sources"
            Parquet[(Parquet File<br/>final_enriched.parquet<br/>2,198 events)]
        end
    end

    Header --> Context
    Map --> SelectionState
    TimeSlider --> TimeState
    NewsList --> SelectionState
    Filters --> FilterState

    Context --> DuckDB
    TimeState --> DuckDB
    SelectionState --> DuckDB
    FilterState --> DuckDB

    DuckDB --> FTS
    DuckDB --> VSS
    DuckDB --> Arrow
    DuckDB --> Cache

    DuckDB --> Parquet
    Arrow --> Map
    Arrow --> NewsList
```

## Component Architecture

```mermaid
graph LR
    subgraph "App Structure"
        App[App.tsx<br/>Providers]

        subgraph "Context Providers"
            Lang[LanguageProvider<br/>EN/AR + RTL]
            Theme[ThemeProvider<br/>Light/Dark]
            DuckDBCtx[DuckDBProvider<br/>SDK + State]
        end

        subgraph "Core Components"
            Header[Header<br/>Controls]
            Main[MainView<br/>Layout Manager]
        end

        subgraph "Feature Components"
            MapView[MapView<br/>MapLibre + Deck.gl]
            TimeControl[TimeRangeSlider<br/>Temporal Filter]
            NewsPanel[NewsPanel<br/>Article List]
            FilterPanel[FilterPanel<br/>Multi-select]
            StatsPanel[StatsPanel<br/>Aggregations]
        end
    end

    App --> Lang
    Lang --> Theme
    Theme --> DuckDBCtx
    DuckDBCtx --> Header
    DuckDBCtx --> Main

    Main --> MapView
    Main --> TimeControl
    Main --> NewsPanel
    Main --> FilterPanel
    Main --> StatsPanel

    MapView -.bbox select.-> NewsPanel
    NewsPanel -.click article.-> MapView
    TimeControl -.date range.-> MapView
    TimeControl -.date range.-> NewsPanel
    FilterPanel -.filters.-> MapView
    FilterPanel -.filters.-> NewsPanel
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Context
    participant DuckDB
    participant Arrow
    participant Map
    participant List

    User->>UI: Load App
    UI->>Context: Initialize
    Context->>DuckDB: Load WASM + Extensions
    DuckDB->>DuckDB: Register Parquet
    DuckDB-->>Context: Ready

    User->>UI: Adjust Time Slider
    UI->>Context: updateTimeRange(start, end)
    Context->>DuckDB: SELECT WHERE date BETWEEN
    DuckDB->>Arrow: Query Result
    Arrow-->>Map: Update Markers
    Arrow-->>List: Update Articles

    User->>Map: Click & Drag BBox
    Map->>Context: updateBBox(bounds)
    Context->>DuckDB: SELECT WHERE lat/lon IN bbox
    DuckDB->>Arrow: Filtered Result
    Arrow-->>List: Update (Cross-filter)

    User->>List: Click Article
    List->>Context: selectArticle(id)
    Context->>Map: flyTo(lat, lon)
    Map-->>Map: Highlight Marker
```

## Cross-Filtering Architecture

```mermaid
graph TB
    subgraph "Filter State"
        Time[Time Range<br/>start: Date<br/>end: Date]
        BBox[Map BBox<br/>north, south<br/>east, west]
        Sentiment[Sentiment<br/>positive/neutral/negative]
        EventType[Event Type<br/>QuadClass 1-4]
        Country[Country<br/>ActionGeo_CountryCode]
        Search[Full-Text Search<br/>title/content]
    end

    subgraph "Query Builder"
        QB[Query Composer]
    end

    subgraph "Consumers"
        Map[Map Layer<br/>Deck.gl Points]
        List[News List<br/>Virtualized]
        Stats[Stats Widgets<br/>Counts/Avg]
        Heatmap[Heatmap Layer<br/>Density]
    end

    Time --> QB
    BBox --> QB
    Sentiment --> QB
    EventType --> QB
    Country --> QB
    Search --> QB

    QB -->|Arrow Table| Map
    QB -->|Arrow Table| List
    QB -->|Aggregates| Stats
    QB -->|Spatial Bins| Heatmap
```

## DuckDB Integration Pattern

```mermaid
graph TB
    subgraph "DuckDB Context Provider"
        Init[useEffect: Initialize]
        Singleton[Global DuckDB Instance<br/>Persistent across HMR]

        subgraph "Public API"
            Query[query(sql): Promise&lt;Arrow&gt;]
            FTSearch[fullTextSearch(q): Promise&lt;Results&gt;]
            Spatial[spatialFilter(bbox): Promise&lt;Results&gt;]
            Temporal[temporalFilter(range): Promise&lt;Results&gt;]
            Stats[getStats(): Promise&lt;Aggregates&gt;]
        end

        subgraph "State"
            Status[status: loading|ready|error]
            Data[cachedData: Map&lt;queryHash, Arrow&gt;]
            Filters[activeFilters: FilterState]
        end
    end

    Init --> Singleton
    Singleton --> Query
    Singleton --> FTSearch
    Singleton --> Spatial
    Singleton --> Temporal
    Singleton --> Stats

    Query --> Data
    FTSearch --> Data
    Spatial --> Data
    Temporal --> Data
```

## Map Visualization Stack

```mermaid
graph TB
    subgraph "Map Stack"
        Container[react-map-gl<br/>MapLibre Wrapper]

        subgraph "Base Layer"
            MapLibre[MapLibre GL<br/>Vector Tiles]
            Style[Map Style<br/>Light/Dark OSM]
        end

        subgraph "Data Layers - Deck.gl"
            Points[ScatterplotLayer<br/>Event Locations]
            Heatmap[HeatmapLayer<br/>Event Density]
            Arcs[ArcLayer<br/>Actor1 → Actor2]
            Text[TextLayer<br/>City Labels]
            Selection[SelectionLayer<br/>BBox Highlight]
        end

        subgraph "Interactions"
            Click[onClick: Article Select]
            Hover[onHover: Tooltip]
            Drag[onDrag: BBox Filter]
            Wheel[onWheel: Zoom Sync]
        end
    end

    Container --> MapLibre
    MapLibre --> Style
    Container --> Points
    Container --> Heatmap
    Container --> Arcs
    Container --> Text
    Container --> Selection

    Points --> Click
    Points --> Hover
    Selection --> Drag
    MapLibre --> Wheel
```

## Time Range Slider Component

```mermaid
graph LR
    subgraph "TimeRangeSlider"
        Input[Dual Thumb Slider<br/>Radix UI]
        Display[Date Range Display<br/>EN: Jan 19, 2025<br/>AR: ١٩ يناير ٢٠٢٥]
        Presets[Quick Presets<br/>Last 7d/30d/All]

        subgraph "State"
            Range[startDate, endDate]
            Bounds[minDate: 2025-01-19<br/>maxDate: 2026-01-27]
            Step[step: 1 day]
        end

        subgraph "Effects"
            Debounce[useDebouncedValue<br/>300ms delay]
            Query[Trigger DuckDB Query]
        end
    end

    Input --> Range
    Display --> Range
    Presets --> Range

    Range --> Bounds
    Range --> Debounce
    Debounce --> Query
```

## Schema & Query Patterns

### Core Table Schema
```typescript
interface GDELTEvent {
  // Identity
  GLOBALEVENTID: bigint;
  SQLDATE: number;          // YYYYMMDD

  // Temporal
  Year: number;
  MonthYear: number;
  FractionDate: number;
  DATEADDED: bigint;

  // Actors
  Actor1Name: string;
  Actor1CountryCode: string;
  Actor1Geo_Lat: number;
  Actor1Geo_Long: number;
  Actor2Name: string;
  Actor2CountryCode: string;

  // Event Classification
  EventCode: string;         // 78 unique codes
  EventBaseCode: string;
  EventRootCode: string;
  QuadClass: number;         // 1-4 (Cooperation → Conflict)
  GoldsteinScale: number;    // -10 to +10

  // Sentiment
  AvgTone: number;           // -12.64 to +14.29

  // Geography
  ActionGeo_Type: number;
  ActionGeo_FullName: string;
  ActionGeo_CountryCode: string;
  ActionGeo_Lat: number;
  ActionGeo_Long: number;

  // Article
  ArticleTitle: string;
  ArticleContent: string;
  ArticleAuthor: string;
  ArticlePublishDate: string;
  ArticleContentLength: bigint;

  // Sources
  SOURCEURL: string;
  NumSources: number;
  NumArticles: number;

  // Quality
  quality_score: number;     // 90-100
}
```

### Key Query Patterns

```sql
-- 1. Temporal + Spatial Filter
SELECT
  GLOBALEVENTID, ArticleTitle, AvgTone,
  ActionGeo_Lat as lat, ActionGeo_Long as lon,
  ActionGeo_CountryCode as country
FROM final_enriched
WHERE SQLDATE BETWEEN ? AND ?
  AND ActionGeo_Lat BETWEEN ? AND ?
  AND ActionGeo_Long BETWEEN ? AND ?
  AND AvgTone IS NOT NULL;

-- 2. Sentiment Aggregation by Country
SELECT
  ActionGeo_CountryCode as country,
  COUNT(*) as event_count,
  AVG(AvgTone) as avg_sentiment,
  AVG(GoldsteinScale) as avg_conflict_intensity,
  MIN(SQLDATE) as first_date,
  MAX(SQLDATE) as last_date
FROM final_enriched
WHERE ActionGeo_CountryCode IS NOT NULL
GROUP BY ActionGeo_CountryCode
ORDER BY event_count DESC;

-- 3. Full-Text Search with FTS Extension
CREATE INDEX IF NOT EXISTS fts_articles
ON final_enriched
USING FTS(ArticleTitle, ArticleContent);

SELECT
  GLOBALEVENTID,
  ArticleTitle,
  fts_main_final_enriched.match_bm25(
    GLOBALEVENTID, ?, fields := 'ArticleTitle,ArticleContent'
  ) as relevance_score
FROM final_enriched
WHERE relevance_score IS NOT NULL
ORDER BY relevance_score DESC
LIMIT 100;

-- 4. Time Series Aggregation
SELECT
  SQLDATE,
  COUNT(*) as events,
  AVG(AvgTone) as avg_tone,
  SUM(CASE WHEN QuadClass = 1 THEN 1 ELSE 0 END) as cooperation,
  SUM(CASE WHEN QuadClass = 4 THEN 1 ELSE 0 END) as conflict
FROM final_enriched
GROUP BY SQLDATE
ORDER BY SQLDATE;

-- 5. Actor Network Query
SELECT
  Actor1Name as source,
  Actor2Name as target,
  COUNT(*) as interaction_count,
  AVG(GoldsteinScale) as avg_intensity,
  AVG(AvgTone) as avg_sentiment
FROM final_enriched
WHERE Actor1Name IS NOT NULL
  AND Actor2Name IS NOT NULL
GROUP BY Actor1Name, Actor2Name
HAVING interaction_count > 2
ORDER BY interaction_count DESC;
```

## Technology Stack

### Core Dependencies
```json
{
  "react": "^19.2.3",
  "typescript": "^5.9.3",
  "vite": "^7.3.0",
  "tailwindcss": "^4.1.18",

  "// DuckDB Stack": "",
  "@duckdb/duckdb-wasm": "^1.30.0",
  "apache-arrow": "^18.1.0",

  "// Map Stack": "",
  "react-map-gl": "^8.1.0",
  "maplibre-gl": "^5.15.0",
  "deck.gl": "^9.1.2",
  "@deck.gl/layers": "^9.1.2",
  "@deck.gl/geo-layers": "^9.1.2",

  "// UI Components": "",
  "@radix-ui/react-slider": "^1.2.0",
  "@radix-ui/react-select": "^2.1.1",
  "@radix-ui/react-tabs": "^1.1.0",
  "lucide-react": "^0.562.0",
  "sonner": "^2.0.7",

  "// Utilities": "",
  "class-variance-authority": "^0.7.1",
  "tailwind-merge": "^3.4.0",
  "date-fns": "^4.1.0"
}
```

## Performance Optimizations

```mermaid
graph TB
    subgraph "Performance Strategy"
        subgraph "Data Layer"
            Arrow[Apache Arrow<br/>Zero-copy Memory]
            Cache[LRU Query Cache<br/>Hash-based]
            Index[DuckDB Indexes<br/>FTS + Spatial]
        end

        subgraph "UI Layer"
            Virtual[Virtual Scrolling<br/>News List]
            Debounce[Debounced Filters<br/>300ms delay]
            Memo[React.memo<br/>Component Cache]
            WebWorker[Web Worker<br/>Heavy Compute]
        end

        subgraph "Rendering"
            DeckGL[Deck.gl GPU<br/>WebGL Rendering]
            Canvas[Canvas Layers<br/>No DOM Reflow]
            RAF[RequestAnimationFrame<br/>Smooth Updates]
        end
    end

    Arrow --> Virtual
    Cache --> Debounce
    Index --> Cache

    Debounce --> Memo
    Memo --> DeckGL
    DeckGL --> Canvas
    Canvas --> RAF
```

## Key Features

### 1. **Cross-Filtering**
- Time slider updates both map and list
- Map bbox selection filters article list
- Article selection flies to location on map
- Filter panel applies to all views simultaneously

### 2. **Real-time Interactions**
- Click article → map flies to location + highlight
- Drag map bbox → list filters to visible articles
- Adjust time slider → all views update with debounce
- Hover marker → show tooltip with article preview

### 3. **Sentiment Visualization**
- Color-coded markers (green=positive, red=negative, gray=neutral)
- Heatmap layer showing event density
- Sentiment trend chart over time
- Country-level sentiment aggregation

### 4. **Internationalization**
- English + Arabic (RTL support)
- Date formatting per locale
- Number formatting (Arabic-Indic numerals)
- Font switching (Inter → Cairo/Tajawal)

### 5. **Theme Support**
- Light/Dark mode with OKLch colors
- Map style switches with theme
- Persistent preference in localStorage
- System preference detection

## File Structure

```
GDELT-SA-playground/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── Header.tsx             # Theme/lang controls
│   │   ├── MapView.tsx            # MapLibre + Deck.gl
│   │   ├── TimeRangeSlider.tsx    # Temporal filter
│   │   ├── NewsPanel.tsx          # Article list
│   │   ├── FilterPanel.tsx        # Multi-select filters
│   │   └── StatsPanel.tsx         # Aggregate metrics
│   ├── context/
│   │   ├── duckdb-context.tsx     # DuckDB SDK provider
│   │   ├── app-state-context.tsx  # Selection/filter state
│   │   └── i18n-context.tsx       # Language provider
│   ├── hooks/
│   │   ├── use-theme.ts           # Theme management
│   │   ├── use-duckdb-query.ts    # Query hook
│   │   └── use-cross-filter.ts    # Filter coordination
│   ├── lib/
│   │   ├── duckdb-client.ts       # DuckDB initialization
│   │   ├── query-builder.ts       # SQL generation
│   │   └── utils.ts               # Helpers
│   ├── types/
│   │   ├── gdelt.ts               # GDELT types
│   │   └── filters.ts             # Filter types
│   ├── i18n/
│   │   ├── en.json                # English translations
│   │   └── ar.json                # Arabic translations
│   ├── App.tsx                    # Root component
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles
├── public/
│   └── data/
│       └── final_enriched.parquet # GDELT dataset
├── vite.config.ts
├── package.json
├── tsconfig.json
└── components.json                # shadcn/ui config
```

## Deployment

- **Host**: GitHub Pages with custom domain
- **Build**: Vite static build
- **CDN**: Parquet file served from same origin
- **Analytics**: PostHog (optional)

## Dataset Summary

- **Size**: 1.9 MB parquet
- **Records**: 2,198 events
- **Date Range**: Jan 19, 2025 - Jan 27, 2026
- **Countries**: 35 unique
- **Event Types**: 78 unique codes
- **Quality Score**: 90-100 (avg: 98.56)
