import { Readability } from "@mozilla/readability";
import { JSDOM } from "linkedom";
import type { NewsArticle } from "./types.js";

/**
 * Extracts readable content from web pages using Readability.
 */
export class ContentExtractor {
  /**
   * Extracts main content from HTML using Readability.
   */
  static extractContent(html: string, url: string): {
    content: string;
    title: string;
    excerpt: string;
    imageUrl?: string;
  } | null {
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        return null;
      }

      return {
        content: article.textContent || article.content || "",
        title: article.title || "",
        excerpt: article.excerpt || "",
        imageUrl: article.byline || undefined,
      };
    } catch (error) {
      console.error(`Failed to extract content from ${url}:`, error);
      return null;
    }
  }

  /**
   * Enhances an article with extracted content.
   */
  static enhanceArticle(
    article: NewsArticle,
    html: string,
  ): NewsArticle & { extractedContent?: string } {
    const extracted = this.extractContent(html, article.url);
    if (extracted) {
      return {
        ...article,
        content: extracted.content,
        description: extracted.excerpt || article.description,
        imageUrl: extracted.imageUrl || article.imageUrl,
        extractedContent: extracted.content,
      };
    }
    return article;
  }
}
