# GDELT Saudi Arabia News Panel

A browser-based news analysis playground for GDELT dataset using DuckDB-WASM, Apache Arrow, MapLibre GL, and Deck.gl. Zero backend - all processing happens in-browser.

## Features

- **Real-time Data Processing**: DuckDB-WASM for efficient SQL queries in the browser
- **Interactive Map**: MapLibre GL + Deck.gl for geospatial visualization
- **Time-based Filtering**: Smooth time range slider with cross-filtering
- **Sentiment Analysis**: Color-coded events based on sentiment (positive/neutral/negative)
- **Multi-language Support**: English and Arabic with RTL support
- **Theme Support**: Light and dark modes
- **Cross-filtering**: Map bbox selection ↔ News list filtering
- **Full-text Search**: DuckDB FTS extension for article search

## Dataset

- **Source**: GDELT Project
- **Size**: 2,198 events
- **Coverage**: Saudi Arabia and related regions
- **Date Range**: January 2025 - January 2026
- **Quality Score**: 90-100 (avg: 98.56)

## Tech Stack

### Core
- React 19 + TypeScript
- Vite 7
- DuckDB-WASM 1.32+
- Apache Arrow 18+

### Visualization
- MapLibre GL 5.17+
- Deck.gl 9.2+
- react-map-gl 8.1+

### UI
- Tailwind CSS 4
- shadcn/ui (Radix UI primitives)
- Lucide React icons

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 10+

### Installation

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Development

```bash
# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui primitives
│   ├── Header.tsx      # Header with theme/lang toggle
│   ├── MapView.tsx     # MapLibre + Deck.gl visualization
│   ├── NewsPanel.tsx   # Article list with virtualization
│   └── TimeRangeSlider.tsx  # Temporal filter
├── context/            # React context providers
│   ├── duckdb-context.tsx   # DuckDB integration
│   └── i18n-context.tsx     # Internationalization
├── hooks/              # Custom React hooks
│   └── use-theme.ts    # Theme management
├── lib/                # Utilities
│   ├── duckdb-client.ts  # DuckDB initialization
│   └── utils.ts        # Helper functions
├── types/              # TypeScript definitions
│   └── gdelt.ts        # GDELT types
├── i18n/               # Translations
│   ├── en.json         # English
│   └── ar.json         # Arabic
└── index.css           # Global styles
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture diagrams and design decisions.

## Key Features Implementation

### Cross-Filtering
- Time slider updates → filters map + news list
- Map bbox drag → filters news list
- Article click → map flies to location

### DuckDB Integration
```typescript
// Query events with filters
const result = await query(`
  SELECT * FROM events
  WHERE date BETWEEN ${startDate} AND ${endDate}
    AND lat BETWEEN ${south} AND ${north}
    AND lon BETWEEN ${west} AND ${east}
  ORDER BY date DESC
  LIMIT 100
`);
```

### Sentiment Visualization
- Positive (> 2): Green markers
- Neutral (-2 to 2): Gray markers
- Negative (< -2): Red markers

## License

MIT

## Author

Tabaqat Dev
