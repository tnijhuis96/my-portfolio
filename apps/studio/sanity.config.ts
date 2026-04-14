import {defineConfig} from "sanity";
import {structureTool} from "sanity/structure";

import {schemaTypes} from "./schemaTypes";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET;

if (!projectId || !dataset) {
  const missingVars = [
    !projectId ? "SANITY_STUDIO_PROJECT_ID" : null,
    !dataset ? "SANITY_STUDIO_DATASET" : null,
  ].filter(Boolean);

  throw new Error(
    `Missing required Sanity Studio environment variable(s): ${missingVars.join(
      ", ",
    )}. Set them before starting or building the Studio.`,
  );
}

export default defineConfig({
  name: "default",
  title: "Analyst Journal",
  projectId,
  dataset,
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
  },
});
