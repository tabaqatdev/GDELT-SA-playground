import { LanguageProvider } from '@/context/i18n-context';
import { DuckDBProvider, useDuckDB } from '@/context/duckdb-context';
import { AppStateProvider } from '@/context/app-state-context';
import { Header } from '@/components/Header';
import { MapView } from '@/components/MapView';
import { TimeRangeSlider } from '@/components/TimeRangeSlider';
import { NewsPanel } from '@/components/NewsPanel';
import { WebGLCheck } from '@/components/WebGLCheck';
import { Toaster } from 'sonner';

function AppContent() {
  const { status, error } = useDuckDB();

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-lg">Initializing System...</p>
          <p className="mt-2 text-sm text-muted-foreground">Loading event data...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-lg text-destructive">Failed to initialize database</p>
          <p className="mb-4 text-sm text-muted-foreground">{error?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <WebGLCheck />
      <Header />
      <main className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Map with time slider overlay - full width on mobile, flex-1 on desktop */}
        <div className="relative flex-1 h-1/2 md:h-auto">
          <MapView />
          <TimeRangeSlider />
        </div>

        {/* News panel - bottom half on mobile, right side on desktop */}
        <div className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l h-1/2 md:h-auto">
          <NewsPanel />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <DuckDBProvider>
        <AppStateProvider>
          <AppContent />
        </AppStateProvider>
      </DuckDBProvider>
    </LanguageProvider>
  );
}
