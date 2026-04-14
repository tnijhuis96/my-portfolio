import { mapTopic } from "./mapTopic";
import type { SiteArticle } from "./types";

export function mapArticle(input: {
  _id: string;
  title: string;
  slug: { current: string };
  summary: string;
  publishedAt?: string;
  topics?: Array<{ title: string; slug: { current: string } }>;
}): SiteArticle {
  return {
    id: input._id,
    title: input.title,
    slug: input.slug.current,
    summary: input.summary,
    publishedAt: input.publishedAt ?? null,
    topics: (input.topics ?? []).map((topic) => mapTopic(topic))
  };
}
