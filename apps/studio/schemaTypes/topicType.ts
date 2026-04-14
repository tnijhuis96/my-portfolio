import {defineField, defineType} from "sanity";

export const topicType = defineType({
  name: "topic",
  title: "Topic",
  type: "document",
  fields: [
    defineField({name: "title", type: "string", validation: (rule) => rule.required()}),
    defineField({
      name: "slug",
      type: "slug",
      options: {source: "title"},
      validation: (rule) => rule.required(),
    }),
    defineField({name: "description", type: "text", validation: (rule) => rule.required()}),
  ],
});
