import { loadConfig } from "../../config/config.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { ContentExtractor } from "./content-extractor.js";
import { RSSParser } from "./rss-parser.js";
import type {
  NewsArticle,
  NewsSource,
  AggregationStatus,
  AggregationConfig,
} from "./types.js";

/**
 * Main news aggregation engine.
 * Fetches articles from RSS feeds and extracts content.
 */
export class NewsAggregator {
  private config: OpenClawConfig;
  private articles: Map<string, NewsArticle> = new Map();
  private status: AggregationStatus = {
    running: false,
    articlesFetched: 0,
    errors: [],
  };

  constructor() {
    this.config = loadConfig();
  }

  /**
   * Gets the aggregation configuration.
   */
  private getConfig(): AggregationConfig {
    const newsConfig = this.config.content?.newsAggregator;
    return {
      enabled: newsConfig?.enabled ?? false,
      sources: newsConfig?.sources || [],
      fetchInterval: newsConfig?.fetchInterval || 60, // default 60 minutes
      storagePath: newsConfig?.storagePath,
      maxArticlesPerSource: newsConfig?.maxArticlesPerSource || 100,
    };
  }

  /**
   * Starts the aggregation process.
   */
  async start(): Promise<void> {
    const config = this.getConfig();
    if (!config.enabled) {
      throw new Error("News aggregator is not enabled in config");
    }

    this.status.running = true;
    this.status.errors = [];

    try {
      await this.fetchAllSources(config.sources);
      this.status.lastRun = new Date();
      this.status.nextRun = new Date(
        Date.now() + config.fetchInterval * 60 * 1000,
      );
    } catch (error) {
      this.status.errors.push(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      this.status.running = false;
    }
  }

  /**
   * Stops the aggregation process.
   */
  stop(): void {
    this.status.running = false;
  }

  /**
   * Fetches articles from all enabled sources.
   */
  private async fetchAllSources(sources: NewsSource[]): Promise<void> {
    const enabledSources = sources.filter((s) => s.enabled);
    let totalFetched = 0;

    for (const source of enabledSources) {
      try {
        const articles = await this.fetchSource(source);
        for (const article of articles) {
          this.articles.set(article.id, article);
        }
        totalFetched += articles.length;
      } catch (error) {
        this.status.errors.push(
          `Failed to fetch ${source.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.status.articlesFetched = totalFetched;
  }

  /**
   * Fetches articles from a single source.
   */
  private async fetchSource(source: NewsSource): Promise<NewsArticle[]> {
    // In practice, this would use web_fetch tool
    // For now, return empty array - actual fetching happens via tool
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    const baseUrl = new URL(source.url).origin;
    const articles = await RSSParser.parseRSS(xml, source, baseUrl);

    // Limit articles per source
    const config = this.getConfig();
    const maxArticles = config.maxArticlesPerSource || 100;
    return articles.slice(0, maxArticles);
  }

  /**
   * Enhances articles with full content extraction.
   */
  async enhanceArticles(articles: NewsArticle[]): Promise<NewsArticle[]> {
    const enhanced: NewsArticle[] = [];

    for (const article of articles) {
      try {
        // In practice, this would use web_fetch tool
        const response = await fetch(article.url);
        if (response.ok) {
          const html = await response.text();
          const enhancedArticle = ContentExtractor.enhanceArticle(
            article,
            html,
          );
          enhanced.push(enhancedArticle);
        } else {
          enhanced.push(article);
        }
      } catch {
        enhanced.push(article);
      }
    }

    return enhanced;
  }

  /**
   * Gets all articles.
   */
  getArticles(): NewsArticle[] {
    return Array.from(this.articles.values());
  }

  /**
   * Gets articles from a specific source.
   */
  getArticlesBySource(sourceId: string): NewsArticle[] {
    return Array.from(this.articles.values()).filter(
      (a) => a.sourceId === sourceId,
    );
  }

  /**
   * Gets aggregation status.
   */
  getStatus(): AggregationStatus {
    return { ...this.status };
  }

  /**
   * Adds a new source.
   */
  addSource(source: NewsSource): void {
    const config = this.getConfig();
    config.sources.push(source);
    // In practice, this would update the config file
  }

  /**
   * Removes a source.
   */
  removeSource(sourceId: string): void {
    const config = this.getConfig();
    config.sources = config.sources.filter((s) => s.id !== sourceId);
    // Remove articles from this source
    for (const [id, article] of this.articles.entries()) {
      if (article.sourceId === sourceId) {
        this.articles.delete(id);
      }
    }
  }
}
