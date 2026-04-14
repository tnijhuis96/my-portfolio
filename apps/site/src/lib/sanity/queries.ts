export const articleListQuery = `*[_type == "article" && status == "published"] | order(publishedAt desc){
  _id,
  title,
  slug,
  summary,
  publishedAt,
  "topics": topics[]->{title, slug}
}`;

export const articleDetailQuery = `*[_type == "article" && status == "published" && slug.current == $slug][0]{
  _id,
  title,
  slug,
  summary,
  publishedAt,
  body,
  "topics": topics[]->{title, slug}
}`;

export const homeQuery = `{
  "settings": *[_type == "siteSettings"][0],
  "featured": *[_type == "article" && status == "published"] | order(publishedAt desc)[0]{
    _id,
    title,
    slug,
    summary,
    publishedAt,
    "topics": topics[]->{title, slug}
  },
  "articles": *[_type == "article" && status == "published"] | order(publishedAt desc)[0...6]{
    _id,
    title,
    slug,
    summary,
    publishedAt,
    "topics": topics[]->{title, slug}
  },
  "topics": *[_type == "topic"] | order(title asc){
    title,
    slug,
    description
  },
  "now": *[_type == "nowPage"][0]{
    title,
    body
  }
}`;

export const topicListQuery = `*[_type == "topic"] | order(title asc){
  title,
  slug,
  description
}`;

export const topicDetailQuery = `*[_type == "topic" && slug.current == $slug][0]{
  title,
  slug,
  description,
  "articles": *[_type == "article" && status == "published" && references(^._id)] | order(publishedAt desc){
    _id,
    title,
    slug,
    summary,
    publishedAt,
    "topics": topics[]->{title, slug}
  }
}`;

export const nowPageQuery = `*[_type == "nowPage"][0]{
  title,
  body
}`;

export const aboutPageQuery = `*[_type == "siteSettings"][0]{
  homeIntro,
  socialLinks
}`;
