import { Moon, Sun, Languages, Link2, Unlink2 } from 'lucide-react';
import { useAppState } from '@/context/app-state-context';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/context/i18n-context';
import { Button } from '@/components/ui/button';

export function Header() {
  const { resolvedTheme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { isMapSyncEnabled, toggleMapSync } = useAppState();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-12 sm:h-14 max-w-screen-2xl items-center px-3 sm:px-4">
        <div className="flex flex-1 items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-lg md:text-xl font-bold truncate">{t('header.title')}</h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleLanguage} 
              title={t('header.language.toggle')}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <Languages className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">{t('header.language.toggle')}</span>
            </Button>


            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMapSync}
              title={isMapSyncEnabled ? "Disable Map Sync (Map movements won't filter list)" : "Enable Map Sync"}
              className={`h-8 w-8 sm:h-10 sm:w-10 ${isMapSyncEnabled ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {isMapSyncEnabled ? (
                <Link2 className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Unlink2 className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleTheme} 
              title={t('header.theme.toggle')}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
              <span className="sr-only">{t('header.theme.toggle')}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
