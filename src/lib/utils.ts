import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, locale: string = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function formatNumber(num: number, locale: string = 'en'): string {
  return new Intl.NumberFormat(locale).format(num);
}

export function sqlDateToDate(sqlDate: number): Date {
  const str = sqlDate.toString();
  const year = parseInt(str.substring(0, 4));
  const month = parseInt(str.substring(4, 6)) - 1;
  const day = parseInt(str.substring(6, 8));
  return new Date(year, month, day);
}

export function dateToSQLDate(date: Date): number {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return parseInt(`${year}${month}${day}`);
}

export function getSentimentCategory(tone: number): 'positive' | 'neutral' | 'negative' {
  if (tone > 2) return 'positive';
  if (tone < -2) return 'negative';
  return 'neutral';
}

export function getSentimentColor(tone: number): string {
  const category = getSentimentCategory(tone);
  return {
    positive: 'var(--color-positive)',
    neutral: 'var(--color-neutral)',
    negative: 'var(--color-negative)',
  }[category];
}
