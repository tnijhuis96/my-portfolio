export type SanityArticleRecord = {
  _id: string;
  title: string;
  slug: { current: string };
  summary: string;
  publishedAt?: string;
  topics?: Array<{ title: string; slug: { current: string } }>;
};
