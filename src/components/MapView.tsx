import { useState, useCallback, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import Map, { ViewState } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { DeckGL } from '@deck.gl/react';
import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import { WebMercatorViewport, FlyToInterpolator } from '@deck.gl/core';
import { useAppState } from '@/context/app-state-context';
import { useEvents } from '@/hooks/use-events';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/context/i18n-context';
import { Button } from '@/components/ui/button';
import { Layers, X, BookOpen, Plus, Minus, Compass } from 'lucide-react';
import { ArticleModal } from './ArticleModal';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE: ViewState = {
  latitude: 24.7136,
  longitude: 46.6753,
  zoom: 5,
  bearing: 0,
  pitch: 45,
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
};

// RTL text plugin URL
const RTL_PLUGIN_URL =
  "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js";

// Map styles for light and dark mode
const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

type LayerMode = 'action' | 'actor1' | 'actor2' | 'arcs' | 'all';

export function MapView() {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  // Default to showing only 3D arcs
  const [activeLayers, setActiveLayers] = useState<Set<LayerMode>>(new Set(['arcs']));
  const [showLayerControls, setShowLayerControls] = useState(false);
  const { selectEvent, selectedEventId, updateBBox, isMapSyncEnabled } = useAppState();
  const { arrowTable, loading } = useEvents();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  
  // Last FlyTo event ref to preventing loops
  const lastFlyToEventRef = useRef<string | null>(null);

  // Selected Arc State for Popup
  const [selectedArc, setSelectedArc] = useState<{
    sourcePosition: [number, number];
    targetPosition: [number, number];
    sourceName: string | null;
    targetName: string | null;
    popupPosition: [number, number];
    eventId: string;
    index: number;
  } | null>(null);

  // Article Modal State
  const [modalArticle, setModalArticle] = useState<{
    title: string;
    content: string;
    author: string | null;
    date: number;
    url: string | null;
    sentiment: number;
    location: string | null;
  } | null>(null);

  // Initialize RTL text plugin for Arabic support
  useEffect(() => {
    if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
      maplibregl.setRTLTextPlugin(
        RTL_PLUGIN_URL,
        true // Lazy load
      );
    }
  }, []);
  
  // Layer Modes Configuration
  const layerModes = [
    { value: 'action' as LayerMode, label: 'Points', color: 'bg-red-500' },
    { value: 'arcs' as LayerMode, label: 'Connections', color: 'bg-blue-500' },
    { value: 'all' as LayerMode, label: 'All Layers', color: 'bg-gray-500' }
  ];

  // Helper to toggle layers
  const toggleLayer = (mode: string) => {
    const newLayers = new Set(activeLayers);
    if (mode === 'all') {
      if (newLayers.has('all')) {
        newLayers.clear();
        newLayers.add('arcs'); 
      } else {
        newLayers.clear();
        newLayers.add('all');
      }
    } else {
      newLayers.delete('all'); // Clear 'all' if toggling specific
      if (newLayers.has(mode as LayerMode)) {
        newLayers.delete(mode as LayerMode);
      } else {
        newLayers.add(mode as LayerMode);
      }
    }
    setActiveLayers(newLayers);
  };
  
  const eventCount = arrowTable ? arrowTable.numRows : 0;

  // Update view state when selected event changes (Auto-Fly)
  useEffect(() => {
    if (selectedEventId && arrowTable && isMapSyncEnabled) {
      // If we just manually flew to this event, SKIP the auto-fly
      if (lastFlyToEventRef.current === selectedEventId) {
         lastFlyToEventRef.current = null; // Reset for next time
         return;
      }

      const idCol = arrowTable.getChild('id');
      const latCol = arrowTable.getChild('lat');
      const lonCol = arrowTable.getChild('lon');

      if (!idCol || !latCol || !lonCol) return;

      // Find the row index for this ID
      // Note: This is a linear scan, acceptable for client-side datasets < 100k
      // For larger datasets, we'd want an index/map.
      let index = -1;
      for (let i = 0; i < arrowTable.numRows; i++) {
        if (idCol.get(i) === selectedEventId) {
          index = i;
          break;
        }
      }

      if (index !== -1) {
        const lat = latCol.get(index);
        const lon = lonCol.get(index);

        if (lat != null && lon != null) {
          setViewState(prev => ({
            ...prev,
            longitude: lon as number,
            latitude: lat as number,
            zoom: 12,
            pitch: 50,
            transitionDuration: 2000,
            // Standard flyTo for list selection can remain simple or use the same dramatic effect
            transitionInterpolator: new FlyToInterpolator({ speed: 1.5, curve: 1.8 })
          }));
        }
      }
    }
  }, [selectedEventId, arrowTable, isMapSyncEnabled]);

  // DeckGL Layers
  const layers = useMemo(() => {
    if (loading || !arrowTable) return [];
    
    // We use a proxy object for data to avoid copying the entire arrow table
    const wrappedData = { length: arrowTable.numRows };
    
    // Get columns once
    const latCol = arrowTable.getChild('lat');
    const lonCol = arrowTable.getChild('lon');
    const sentimentCol = arrowTable.getChild('sentiment');
    const idCol = arrowTable.getChild('id');
    const actor1LatCol = arrowTable.getChild('actor1_lat');
    const actor1LonCol = arrowTable.getChild('actor1_lon');
    const actor2LatCol = arrowTable.getChild('actor2_lat');
    const actor2LonCol = arrowTable.getChild('actor2_lon');

    if (!latCol || !lonCol || !sentimentCol) return [];

    const allLayers = [];

    // 1. Action Layer (Scatterplot) - Points of the event itself
    if (activeLayers.has('action') || (activeLayers.has('all') && !activeLayers.has('arcs'))) {
      allLayers.push(
        new ScatterplotLayer({
          id: 'action-layer',
          data: wrappedData,
          pickable: true,
          opacity: 0.8,
          stroked: true,
          filled: true,
          radiusScale: 6,
          radiusMinPixels: 3,
          radiusMaxPixels: 30,
          lineWidthMinPixels: 1,
          getPosition: (_: any, { index }: { index: number }) => {
            const lon = lonCol.get(index);
            const lat = latCol.get(index);
            if (lon == null || lat == null) return [0, 0];
            return [lon as number, lat as number];
          },
          getFillColor: (_: any, { index }: { index: number }) => {
             const sentiment = sentimentCol.get(index) as number;
             // Color scale based on sentiment: Red (neg) -> Grey -> Green (pos)
             if (sentiment < -5) return [239, 68, 68, 200]; // Red-500
             if (sentiment > 5) return [34, 197, 94, 200];  // Green-500
             return [156, 163, 175, 200]; // Gray-400
          },
          getLineColor: [0, 0, 0, 80],
          onClick: (info: any) => {
             if (info.index >= 0 && idCol) {
               const id = idCol.get(info.index);
               if (id) selectEvent(id as string);
             }
          },
          updateTriggers: {
             getFillColor: [arrowTable] // Update if table changes
          }
        })
      );
    }

    // 2. Arc Layer - Connections between Actor1 and Actor2
    // Only show if we have valid coordinates for both actors
    if (activeLayers.has('arcs') &&
        actor1LatCol && actor1LonCol && actor2LatCol && actor2LonCol) {
      allLayers.push(
        new ArcLayer({
          id: 'arc-layer',
          data: wrappedData,
          pickable: true,
          opacity: 0.6,
          getWidth: (_: any, { index }: { index: number }) => {
            const sentiment = sentimentCol.get(index) as number;
            return Math.abs(sentiment) * 0.5 + 1;
          },
          getSourcePosition: (_: any, { index }: { index: number }) => {
            const lon = actor1LonCol.get(index);
            const lat = actor1LatCol.get(index);
            if (lon == null || lat == null) return [0, 0, -1];
            return [lon as number, lat as number];
          },
          getTargetPosition: (_: any, { index }: { index: number }) => {
            const lon = actor2LonCol.get(index);
            const lat = actor2LatCol.get(index);
            if (lon == null || lat == null) return [0, 0, -1];
            return [lon as number, lat as number];
          },
          getSourceColor: [59, 130, 246, 200], // Blue (Actor 1)
          getTargetColor: [168, 85, 247, 200], // Purple (Actor 2)
          getHeight: 0.3,
          greatCircle: true,
          onClick: (info: any) => {
            if (info.index >= 0 && idCol && actor1LatCol && actor1LonCol && actor2LatCol && actor2LonCol) {
              const index = info.index;
              const sourceLat = actor1LatCol.get(index) as number;
              const sourceLon = actor1LonCol.get(index) as number;
              const targetLat = actor2LatCol.get(index) as number;
              const targetLon = actor2LonCol.get(index) as number;
              
              const actor1NameCol = arrowTable?.getChild('actor1');
              const actor2NameCol = arrowTable?.getChild('actor2');
              
              const sourceName = actor1NameCol?.get(index) as string | null;
              const targetName = actor2NameCol?.get(index) as string | null;

              if (sourceLat != null && sourceLon != null && targetLat != null && targetLon != null) {
                const id = idCol.get(index) as string;
                setSelectedArc({
                  sourcePosition: [sourceLon, sourceLat],
                  targetPosition: [targetLon, targetLat],
                  sourceName: sourceName || 'Actor 1',
                  targetName: targetName || 'Actor 2',
                  popupPosition: info.coordinate,
                  eventId: id,
                  index: index
                });
              }
            }
          },
        })
      );
    }

    return allLayers;
  }, [arrowTable, loading, activeLayers, selectEvent]);

  // Debounce ref to prevent excessive updates during map movement/animation
  const bboxTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleViewStateChange = useCallback(
    ({ viewState: newViewState }: any) => {
      setViewState(newViewState);
      
      if (!isMapSyncEnabled) return;

      // Clear existing timeout
      if (bboxTimeoutRef.current) {
        clearTimeout(bboxTimeoutRef.current);
      }

      // Set new timeout (debounce)
      bboxTimeoutRef.current = setTimeout(() => {
        const viewport = new WebMercatorViewport(newViewState);
        const bounds = viewport.getBounds(); // [west, south, east, north]
        if (bounds) {
          updateBBox({
            west: bounds[0],
            south: bounds[1],
            east: bounds[2],
            north: bounds[3]
          });
        }
      }, 500); 
    },
    [updateBBox, isMapSyncEnabled]
  );
  
  // Ref for container dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (containerRef.current) {
      const { offsetWidth, offsetHeight } = containerRef.current;
      setDimensions({ width: offsetWidth, height: offsetHeight });
      
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
           setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Calculate Popup Screen Position
  const popupPixel = useMemo(() => {
     if (!selectedArc || dimensions.width === 0 || dimensions.height === 0) return null;
     
     const viewport = new WebMercatorViewport({
        ...viewState,
        width: dimensions.width,
        height: dimensions.height
     });
     
     return viewport.project(selectedArc.popupPosition);
  }, [selectedArc, viewState, dimensions]);

  const handleReadMore = () => {
    if (!selectedArc || !arrowTable) return;
    
    // Fetch article details using the stored index
    const index = selectedArc.index;
    
    const titleCol = arrowTable.getChild('title');
    const contentCol = arrowTable.getChild('content');
    const authorCol = arrowTable.getChild('author');
    const dateCol = arrowTable.getChild('date');
    const urlCol = arrowTable.getChild('url');
    const sentimentCol = arrowTable.getChild('sentiment');
    const locationCol = arrowTable.getChild('location');

    if (titleCol && contentCol && dateCol && sentimentCol) {
       setModalArticle({
          title: titleCol.get(index) as string,
          content: contentCol.get(index) as string,
          author: authorCol?.get(index) as string | null,
          date: dateCol.get(index) as number,
          url: urlCol?.get(index) as string | null,
          sentiment: sentimentCol.get(index) as number,
          location: locationCol?.get(index) as string | null
       });
       // Optionally close the map popup? User might want to keep context.
       // Let's close it to avoid clutter.
       setSelectedArc(null);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative h-full w-full" 
      onContextMenu={(e) => e.preventDefault()}
    >
      <DeckGL
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        controller={{
            doubleClickZoom: true,
            touchRotate: true,
            dragRotate: true,
            keyboard: true,
            dragPan: true,
        }}
        layers={layers}
        onError={(error) => {
          if (error.message?.includes('maxTextureDimension2D')) return;
          console.error('Deck.gl error:', error);
        }}
        getTooltip={(info: any) => {
          if (info.index < 0 || !arrowTable) return null;
          // Don't show tooltip for arc layer (as we have a click popup)
          if (info.layer?.id === 'arc-layer') {
             return {
               text: "Click for options",
               style: {
                  backgroundColor: 'white',
                  color: 'black',
                  fontSize: '11px',
                  padding: '4px',
                  borderRadius: '4px'
               }
             };
          }
          // ... existing point tooltip logic ...
          return null;
        }}
      >
        <Map
          mapStyle={
            resolvedTheme === 'dark'
              ? MAP_STYLES.dark
              : MAP_STYLES.light
          }
          style={{ width: '100%', height: '100%' }}
        >
        </Map>
      </DeckGL>
      
      {/* Custom Popup Overlay */}
      {selectedArc && popupPixel && (
        <div 
            className="absolute z-[100] bg-background border rounded-md shadow-lg p-2 min-w-[200px] flex flex-col gap-2 pointer-events-auto"
            style={{
                left: popupPixel[0],
                top: popupPixel[1],
                transform: 'translate(-50%, -100%)',
                marginTop: '-10px' 
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between mb-1 border-b pb-1">
                <span className="font-semibold text-sm">{t('map.flyTo')}</span>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedArc(null);
                    }}
                    className="p-1 hover:bg-muted rounded-full"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
            
            {/* Fly to Source */}
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full justify-start text-left h-auto py-2 px-3 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                if (selectedArc.eventId) {
                   lastFlyToEventRef.current = selectedArc.eventId;
                   selectEvent(selectedArc.eventId);
                }
                const randomBearing = (Math.random() * 60) - 30;
                setViewState(prev => ({
                  ...prev,
                  longitude: selectedArc.sourcePosition[0],
                  latitude: selectedArc.sourcePosition[1],
                  zoom: 12,
                  pitch: 50,
                  bearing: randomBearing, 
                  transitionDuration: 'auto',
                  transitionInterpolator: new FlyToInterpolator({ speed: 1.5, curve: 1.8 })
                } as any));
                setSelectedArc(null);
              }}
            >
              <div className="flex flex-col items-start truncate w-full">
                <span className="font-medium text-blue-600 truncate w-full">{selectedArc.sourceName}</span>
                <span className="text-[10px] text-muted-foreground">{t('map.source')}</span>
              </div>
            </Button>

            {/* Fly to Target */}
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full justify-start text-left h-auto py-2 px-3 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                if (selectedArc.eventId) {
                   lastFlyToEventRef.current = selectedArc.eventId;
                   selectEvent(selectedArc.eventId);
                }
                const randomBearing = (Math.random() * 60) - 30;
                setViewState(prev => ({
                  ...prev,
                  longitude: selectedArc.targetPosition[0],
                  latitude: selectedArc.targetPosition[1],
                  zoom: 12,
                  pitch: 50,
                  bearing: randomBearing, 
                  transitionDuration: 'auto',
                  transitionInterpolator: new FlyToInterpolator({ speed: 1.5, curve: 1.8 })
                } as any));
                setSelectedArc(null);
              }}
            >
              <div className="flex flex-col items-start truncate w-full">
                 <span className="font-medium text-purple-600 truncate w-full">{selectedArc.targetName}</span>
                 <span className="text-[10px] text-muted-foreground">{t('map.target')}</span>
              </div>
            </Button>
            
            {/* Read More Button */}
            <div className="pt-1 mt-1 border-t">
              <Button
                size="sm"
                variant="ghost" 
                className="w-full justify-start text-left h-auto py-1.5 px-3 text-xs hover:bg-accent text-primary"
                onClick={(e) => {
                    e.stopPropagation();
                    console.log('Opening article modal for index:', selectedArc.index);
                    handleReadMore();
                }}
              >
                 <BookOpen className="h-3 w-3 mr-2" />
                 {t('news.readMore')}
              </Button>
            </div>
        </div>
      )}

      {loading && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-background/90 px-4 py-2 shadow-lg">
          <p className="text-sm">Loading events...</p>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <div className="flex flex-col rounded-md border bg-background/90 shadow-lg backdrop-blur">
          <Button
            variant="ghost" 
            size="icon"
            className="h-8 w-8 rounded-none rounded-t-md border-b hover:bg-accent"
            onClick={() => setViewState(v => ({
              ...v,
              zoom: (v.zoom || 0) + 1,
              transitionDuration: 300
            }))}
            aria-label="Zoom In"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none rounded-b-md hover:bg-accent"
            onClick={() => setViewState(v => ({
              ...v,
              zoom: (v.zoom || 0) - 1,
              transitionDuration: 300
            }))}
            aria-label="Zoom Out"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
        
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/90 shadow-lg backdrop-blur"
          onClick={() => setViewState(v => ({
            ...v,
            bearing: 0,
            pitch: 0,
            transitionDuration: 500
          }))}
          aria-label="Reset North"
        >
          <Compass 
            className="h-4 w-4 transition-transform duration-500" 
            style={{ transform: `rotate(${-viewState.bearing}deg)` }} 
          />
        </Button>
      </div>

      {/* Layer Controls - Shifted down to avoid conflict */}
      <div className="absolute left-4 top-4 z-10">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowLayerControls(!showLayerControls)}
          className="bg-background/90 shadow-lg backdrop-blur"
        >
          <Layers className="h-5 w-5" />
        </Button>

        {showLayerControls && (
          <div className="mt-2 rounded-lg border bg-background/95 p-3 shadow-xl backdrop-blur w-48">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">Layers</p>
              <button 
                onClick={() => toggleLayer('all')}
                className="text-[10px] text-muted-foreground hover:text-primary"
              >
                Toggle All
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {layerModes.map((mode) => {
                const isActive = activeLayers.has(mode.value);
                return (
                  <button
                    key={mode.value}
                    onClick={() => toggleLayer(mode.value)}
                    className={`flex items-center gap-2 rounded px-3 py-1.5 text-left text-xs transition-colors ${
                      isActive
                        ? 'bg-accent font-medium'
                        : 'hover:bg-accent/50 text-muted-foreground'
                    }`}
                  >
                    <div className={`h-3 w-3 rounded border flex items-center justify-center ${
                      isActive ? mode.color + ' border-transparent' : 'border-input'
                    }`}>
                      {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Event Count */}
      <div className="absolute bottom-4 left-4 rounded-md bg-background/90 px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold">{eventCount} events</p>
        <p className="text-muted-foreground">Active Layers: {activeLayers.size}</p>
      </div>
      
      <ArticleModal 
         isOpen={!!modalArticle}
         onClose={() => setModalArticle(null)}
         article={modalArticle}
      />
    </div>
  );
}

