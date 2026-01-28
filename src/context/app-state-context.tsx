import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { BBox, TimeRange, FilterState } from '@/types/gdelt';

interface AppStateContextValue {
  filters: FilterState;
  selectedEventId: string | null;
  updateTimeRange: (range: TimeRange) => void;
  updateBBox: (bbox: BBox | null) => void;
  updateSentiment: (sentiment: FilterState['sentiment']) => void;
  updateEventTypes: (types: number[]) => void;
  updateCountries: (countries: string[]) => void;
  updateSearch: (query: string) => void;
  selectEvent: (id: string | null) => void;
  clearFilters: () => void;
  isMapSyncEnabled: boolean;
  toggleMapSync: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

// Default date range: all data from dataset
const DEFAULT_TIME_RANGE: TimeRange = {
  start: 20250119, // Jan 19, 2025
  end: 20260127,   // Jan 27, 2026
};

const DEFAULT_FILTERS: FilterState = {
  timeRange: DEFAULT_TIME_RANGE,
  bbox: null,
  sentiment: ['positive', 'neutral', 'negative'],
  eventTypes: [1, 2, 3, 4], // All quad classes
  countries: [],
  searchQuery: '',
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const updateTimeRange = useCallback((range: TimeRange) => {
    setFilters((prev) => ({ ...prev, timeRange: range }));
  }, []);

  const updateBBox = useCallback((bbox: BBox | null) => {
    setFilters((prev) => ({ ...prev, bbox }));
  }, []);

  const updateSentiment = useCallback((sentiment: FilterState['sentiment']) => {
    setFilters((prev) => ({ ...prev, sentiment }));
  }, []);

  const updateEventTypes = useCallback((types: number[]) => {
    setFilters((prev) => ({ ...prev, eventTypes: types }));
  }, []);

  const updateCountries = useCallback((countries: string[]) => {
    setFilters((prev) => ({ ...prev, countries }));
  }, []);

  const updateSearch = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const [isMapSyncEnabled, setIsMapSyncEnabled] = useState(true);

  const toggleMapSync = useCallback(() => {
    setIsMapSyncEnabled(prev => !prev);
  }, []);

  const selectEvent = useCallback((id: string | null) => {
    setSelectedEventId(id);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(() => ({
      ...DEFAULT_FILTERS,
      // Keep search query if needed, but let's clear everything
      // Keep bbox if map sync is enabled? Usually reset means reset all.
      bbox: null 
    }));
    setSelectedEventId(null);
  }, []);

  return (
    <AppStateContext.Provider
      value={{
        filters,
        selectedEventId,
        updateTimeRange,
        updateBBox,
        updateSentiment,
        updateEventTypes,
        updateCountries,
        updateSearch,
        selectEvent,
        clearFilters,
        isMapSyncEnabled,
        toggleMapSync,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
