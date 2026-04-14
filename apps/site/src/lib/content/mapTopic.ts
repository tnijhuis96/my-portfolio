export function mapTopic(input: {
  title: string;
  slug: { current: string };
}) {
  return {
    title: input.title,
    slug: input.slug.current
  };
}
