import type { SiteTopic } from "./types";

export function mapTopic(input: {
  title: string;
  slug: { current: string };
}): SiteTopic {
  return {
    title: input.title,
    slug: input.slug.current
  };
}
