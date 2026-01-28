import { X, Calendar, User, Globe, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, sqlDateToDate, getSentimentCategory } from '@/lib/utils';
import { useLanguage } from '@/context/i18n-context';
import { useTranslation } from '@/context/i18n-context';

interface ArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: {
    title: string;
    content: string;
    author: string | null;
    date: number;
    url: string | null;
    source?: string;
    sentiment: number;
    location: string | null;
  } | null;
}

export function ArticleModal({ isOpen, onClose, article }: ArticleModalProps) {
  const { language } = useLanguage();
  const { t } = useTranslation();

  if (!isOpen || !article) return null;

  const sentimentCategory = getSentimentCategory(article.sentiment);

  // Extract source domain if possible
  const getSourceDomain = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-background shadow-2xl animate-in zoom-in-95 duration-200 border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-background/95 p-6 backdrop-blur">
          <div className="pr-8">
            <h2 className="text-xl sm:text-2xl font-bold leading-tight tracking-tight">
              {article.title}
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium sentiment-${sentimentCategory} bg-accent`}>
                 {t('news.sentiment')}: {article.sentiment.toFixed(2)}
              </span>
              {article.location && (
                <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                  {article.location}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* content */}
        <div className="p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted-foreground rounded-lg bg-accent/50 p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{formatDate(sqlDateToDate(article.date), language)}</span>
            </div>
            {article.author && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="truncate">{article.author}</span>
              </div>
            )}
            {article.url && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <span className="truncate">{getSourceDomain(article.url)}</span>
              </div>
            )}
          </div>

          <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none leading-relaxed">
             {/* Simple paragraph handling for now, can be improved */}
             {article.content.split('\n').map((paragraph, idx) => (
                paragraph.trim() && <p key={idx} className="mb-4 text-foreground/90">{paragraph}</p>
             ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t bg-background/95 p-4 backdrop-blur flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {article.url && (
            <Button asChild>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                {t('news.readMore')} <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
