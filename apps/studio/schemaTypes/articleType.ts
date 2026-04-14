import {defineField, defineType} from "sanity";

export const articleType = defineType({
  name: "article",
  title: "Article",
  type: "document",
  fields: [
    defineField({name: "title", type: "string", validation: (rule) => rule.required()}),
    defineField({
      name: "slug",
      type: "slug",
      options: {source: "title"},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "summary",
      type: "text",
      validation: (rule) => rule.required().max(220),
    }),
    defineField({name: "publishedAt", type: "datetime"}),
    defineField({
      name: "topics",
      type: "array",
      of: [{type: "reference", to: [{type: "topic"}]}],
    }),
    defineField({name: "body", type: "array", of: [{type: "block"}]}),
  ],
});
