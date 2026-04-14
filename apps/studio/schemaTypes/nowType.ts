import {defineField, defineType} from "sanity";

export const nowType = defineType({
  name: "nowPage",
  title: "Now Page",
  type: "document",
  fields: [
    defineField({name: "title", type: "string", initialValue: "What I'm exploring now"}),
    defineField({name: "body", type: "array", of: [{type: "block"}]}),
  ],
});
