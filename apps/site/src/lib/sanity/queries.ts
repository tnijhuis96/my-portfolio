export const articleListQuery = `*[_type == "article"] | order(publishedAt desc){
  _id,
  title,
  slug,
  summary,
  publishedAt,
  "topics": topics[]->{title, slug}
}`;
