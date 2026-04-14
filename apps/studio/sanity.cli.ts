import {defineCliConfig} from "sanity/cli";

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
    )}. Set them before running Sanity CLI commands.`,
  );
}

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
});
