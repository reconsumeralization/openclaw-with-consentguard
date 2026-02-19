export type NewsSource = {
  id: string;
  name: string;
  url: string;
  type: "rss" | "atom" | "json";
  enabled: boolean;
  lastFetched?: Date;
  fetchInterval?: number; // minutes
};

export type NewsArticle = {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  description?: string;
  content?: string;
  publishedAt: Date;
  fetchedAt: Date;
  author?: string;
  categories?: string[];
  imageUrl?: string;
};

export type AggregationStatus = {
  running: boolean;
  lastRun?: Date;
  nextRun?: Date;
  articlesFetched: number;
  errors: string[];
};

export type AggregationConfig = {
  enabled: boolean;
  sources: NewsSource[];
  fetchInterval: number; // minutes
  storagePath?: string;
  maxArticlesPerSource?: number;
};
