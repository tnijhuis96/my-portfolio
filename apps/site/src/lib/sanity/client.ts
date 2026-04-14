import { createClient } from "@sanity/client";

export const hasSanityConfig = Boolean(
  import.meta.env.PUBLIC_SANITY_PROJECT_ID && import.meta.env.PUBLIC_SANITY_DATASET
);

export const sanityClient = createClient({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID ?? "local",
  dataset: import.meta.env.PUBLIC_SANITY_DATASET ?? "local",
  apiVersion: "2026-04-13",
  useCdn: true
});
