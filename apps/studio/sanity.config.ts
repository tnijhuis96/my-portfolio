import {defineConfig} from "sanity";

import {schemaTypes} from "./schemaTypes";

export default defineConfig({
  name: "default",
  title: "Analyst Journal",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: process.env.SANITY_STUDIO_DATASET!,
  schema: {
    types: schemaTypes,
  },
});
