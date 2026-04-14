import { mapTopic } from "./mapTopic";
import type { SanityArticleRecord } from "./sanity";
import type { SiteArticle } from "./types";

export function mapArticle(input: SanityArticleRecord): SiteArticle {
  return {
    id: input._id,
    title: input.title,
    slug: input.slug.current,
    summary: input.summary,
    publishedAt: input.publishedAt ?? null,
    topics: (input.topics ?? []).map((topic) => mapTopic(topic))
  };
}
