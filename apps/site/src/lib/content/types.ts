export type SiteTopic = {
  title: string;
  slug: string;
};

export type SiteArticle = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  publishedAt: string | null;
  topics: SiteTopic[];
};
