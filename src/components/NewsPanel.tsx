import { useState, useEffect, useRef } from 'react';
import { useAppState } from '@/context/app-state-context';
import { useEvents } from '@/hooks/use-events';
import { useAutocomplete } from '@/hooks/use-autocomplete';
import { useTranslation } from '@/context/i18n-context';
import { sqlDateToDate, formatDate, getSentimentCategory } from '@/lib/utils';
import { useLanguage } from '@/context/i18n-context';
import { Search, X, MapPin, User, Building, BookOpen } from 'lucide-react';
import { ArticleModal } from './ArticleModal';

export function NewsPanel() {
  const { arrowTable, loading } = useEvents();
  const { selectEvent, selectedEventId, updateSearch, filters } = useAppState();
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [searchInput, setSearchInput] = useState(filters.searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [modalArticle, setModalArticle] = useState<{
    title: string;
    content: string;
    author: string | null;
    date: number;
    url: string | null;
    sentiment: number;
    location: string | null;
  } | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  // Fetch autocomplete suggestions
  const { suggestions } = useAutocomplete(searchInput);

  // Debounced search update
  useEffect(() => {
    const timer = setTimeout(() => {
      updateSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, updateSearch]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (term: string) => {
    setSearchInput(term);
    setShowSuggestions(false);
    // Immediate update on selection
    updateSearch(term);
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'location': return <MapPin className="h-3 w-3 text-muted-foreground" />;
      case 'city': return <Building className="h-3 w-3 text-muted-foreground" />;
      default: return <User className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">{t('news.loading')}</p>
        </div>
      );
    }

    if (!arrowTable || arrowTable.numRows === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">{t('news.empty')}</p>
        </div>
      );
    }

    // Get columns from Arrow table - zero copy!
    const idCol = arrowTable.getChild('id');
    const titleCol = arrowTable.getChild('title');
    const contentCol = arrowTable.getChild('content'); // View uses 'content' not 'content_preview'
    const sentimentCol = arrowTable.getChild('sentiment');
    const dateCol = arrowTable.getChild('date');
    const locationCol = arrowTable.getChild('location');
    const urlCol = arrowTable.getChild('url');
    const authorCol = arrowTable.getChild('author');

    if (!idCol || !titleCol || !contentCol || !sentimentCol || !dateCol) {
      return null;
    }

    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: arrowTable.numRows }).map((_, index) => {
          const id = idCol.get(index) as string;
          const title = titleCol.get(index) as string;
          const content = contentCol.get(index) as string;
          const sentiment = sentimentCol.get(index) as number;
          const date = dateCol.get(index) as number;
          const location = locationCol?.get(index) as string | null;
          const url = urlCol?.get(index) as string | null;
          const author = authorCol?.get(index) as string | null;

          const sentimentCategory = getSentimentCategory(sentiment);
          const isSelected = id === selectedEventId;

          return (
            <article
              key={`${id}-${index}`}
              onClick={() => selectEvent(id)}
              className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-accent ${
                isSelected ? 'border-primary bg-accent' : ''
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="flex-1 font-semibold leading-tight">{title}</h3>
                <span
                  className={`shrink-0 text-xs font-medium sentiment-${sentimentCategory}`}
                >
                  {sentiment > 0 ? '+' : ''}
                  {sentiment.toFixed(1)}
                </span>
              </div>

              <p className="mb-3 line-clamp-3 text-sm text-muted-foreground">{content}</p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground w-full">
                {location && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground" />
                    {location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground" />
                  {formatDate(sqlDateToDate(date), language)}
                </span>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalArticle({
                      title,
                      content,
                      author, 
                      date,
                      url,
                      sentiment,
                      location
                    });
                  }}
                  className="flex items-center gap-1 hover:text-primary transition-colors ml-auto font-medium"
                >
                  <BookOpen className="h-3 w-3" />
                  {t('news.readMore')}
                </button>
              </div>
            </article>
          );
        })}
        
        <ArticleModal 
          isOpen={!!modalArticle}
          onClose={() => setModalArticle(null)}
          article={modalArticle}
        />
      </div>
    );
  };
   // ... rest of component


  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4 relative z-20">
        <h2 className="text-lg font-semibold">{t('news.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {arrowTable ? arrowTable.numRows : 0} {(!arrowTable || arrowTable.numRows === 1) ? t('news.article') : t('news.articles')}
        </p>
        
        {/* Search Input with Autocomplete */}
        <div ref={searchContainerRef} className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={t('filters.search.placeholder')}
            className="w-full rounded-md border bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                updateSearch('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md overflow-hidden">
              <div className="p-1">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={`${suggestion.term}-${i}`}
                    onClick={() => handleSuggestionClick(suggestion.term)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-left"
                  >
                    {getSuggestionIcon(suggestion.type)}
                    <span className="flex-1 truncate">{suggestion.term}</span>
                    <span className="text-xs text-muted-foreground opacity-70">
                      {suggestion.frequency}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
