import {defineField, defineType} from "sanity";

export const siteSettingsType = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({name: "homeIntro", type: "text", validation: (rule) => rule.required()}),
    defineField({name: "socialLinks", type: "array", of: [{type: "url"}]}),
  ],
});
