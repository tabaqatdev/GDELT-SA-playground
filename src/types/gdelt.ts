export interface GDELTEvent {
  GLOBALEVENTID: bigint;
  SQLDATE: number;
  Year: number;
  MonthYear: number;
  FractionDate: number;
  DATEADDED: bigint;

  // Actors
  Actor1Name: string | null;
  Actor1CountryCode: string | null;
  Actor1Geo_Lat: number | null;
  Actor1Geo_Long: number | null;
  Actor2Name: string | null;
  Actor2CountryCode: string | null;

  // Event Classification
  EventCode: string;
  EventBaseCode: string;
  EventRootCode: string;
  QuadClass: number;
  GoldsteinScale: number;

  // Sentiment
  AvgTone: number;
  NumMentions: number;
  NumSources: number;
  NumArticles: number;

  // Geography
  ActionGeo_Type: number;
  ActionGeo_FullName: string;
  ActionGeo_CountryCode: string;
  ActionGeo_Lat: number;
  ActionGeo_Long: number;

  // Article
  ArticleTitle: string;
  ArticleContent: string;
  ArticleAuthor: string | null;
  ArticlePublishDate: string | null;
  ArticleContentLength: bigint;

  // Sources
  SOURCEURL: string;

  // Quality
  quality_score: number;
}

export interface GDELTEventSimplified {
  id: string;
  date: number;
  title: string;
  content: string;
  author: string | null;
  url: string;
  sentiment: number;
  eventType: number;
  lat: number;
  lon: number;
  country: string;
  location: string;
  actor1: string | null;
  actor2: string | null;
  goldstein: number;
}

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TimeRange {
  start: number; // SQLDATE format
  end: number;   // SQLDATE format
}

export interface FilterState {
  timeRange: TimeRange;
  bbox: BBox | null;
  sentiment: ('positive' | 'neutral' | 'negative')[];
  eventTypes: number[];
  countries: string[];
  searchQuery: string;
}

export interface StatsData {
  totalEvents: number;
  avgSentiment: number;
  countryCounts: { country: string; count: number }[];
  eventTypeCounts: { type: number; count: number }[];
  dailyCounts: { date: number; count: number; avgTone: number }[];
}
