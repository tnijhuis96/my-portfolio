# Analyst Journal Redesign Spec

## Summary

Rebuild the current portfolio into a content-first publication site focused on technology understanding, tools, AI automation, and implications for SME companies. The new experience should replace the current custom static generator plus local CMS workflow with a modern static frontend and a browser-based CMS that supports drafting and publishing without manual Git steps.

The chosen direction is **Analyst Journal with Guidebook structure**: a thoughtful, personal editorial voice supported by clearer topic-based navigation and more useful reading paths.

## Why this redesign exists

The current site has three main problems:

1. The visual design feels weak.
2. Updating pages and publishing content is cumbersome.
3. The site identity no longer matches the owner’s direction.

The next version should feel more personal, more credible, and much easier to publish to.

## Goals

- Create a stronger editorial identity around technology analysis, tools, AI automation, and SME impact.
- Make writing and publishing feel clean and low-friction in a browser-based CMS.
- Keep the public site fast, static, and easy to host on Cloudflare Pages.
- Move away from repo-driven “projects portfolio” framing.
- Replace the current custom build/admin architecture with clearer boundaries and simpler long-term maintenance.

## Non-goals

- Rebuilding the current local Express CMS.
- Keeping live GitHub project fetching.
- Preserving the old file-based markdown workflow as the primary publishing path.
- Building complex dashboards, automation control panels, or custom analytics in the first version.
- Modeling every possible content type before the core writing flow is excellent.

## Audience and positioning

The site is primarily for readers who want to understand:

- how modern tools change the shape of work
- how AI automation affects practical business operations
- how SME companies can think about software, systems, and workflows

Secondarily, the site should help other people understand the author’s thinking, interests, and evolving expertise.

The tone should be:

- thoughtful
- clear
- grounded
- personal without becoming diaristic

The site should feel authored by a person with a point of view, not by a generic publication template.

## Product direction

The site will not be centered on “projects” or GitHub activity. Instead, it will center on writing, topic exploration, and current thinking.

The defining product direction is:

**personal editorial voice up top, useful structure underneath**

That means the experience should lead with perspective and guide readers into curated topic areas and article archives.

## Chosen architecture

The new system is split into three parts:

1. **Public site**
   - Built with **Astro**
   - Component-based, static-first frontend
   - Responsible for design system, layouts, page rendering, SEO, and content presentation

2. **CMS/content layer**
   - Managed in **Sanity**
   - Responsible for writing, drafts, publishing, topic assignment, and editable site content

3. **Hosting/deploy layer**
   - **Cloudflare Pages** for public hosting
   - Production deploys update intentionally from `master`
   - Published CMS changes trigger rebuilds automatically

This architecture replaces the current `build.js` monolith and `adminServer.js` local CMS workflow.

## Publishing flow

The intended publishing flow is:

**open CMS -> write/edit -> save draft or publish -> automatic rebuild -> live on site**

This flow must not require:

- local server usage
- manual markdown file handling
- manual Git pushes for content publishing

Code changes remain a developer workflow. Content publishing becomes an editorial workflow.

## Information architecture

### Primary navigation

- Home
- Topics
- Articles
- Now
- About

### Page responsibilities

**Home**
- Lead with the author’s point of view
- Introduce the site’s purpose and current focus
- Feature a key piece of writing
- Surface topic hubs
- Show recent articles

**Topics**
- Curated landing pages for core themes such as:
  - AI Automation
  - Tools & Workflows
  - SME Impact
- These pages should help readers explore by subject rather than chronology

**Articles**
- The main chronological archive for all published writing

**Now**
- A lightweight, current snapshot of what the author is studying, testing, or thinking about

**About**
- Who the author is
- What the site is for
- How to interpret the perspective and interests behind the writing

## Homepage structure

The homepage should follow this hierarchy:

1. Personal editorial hero
2. Current focus or what the author is exploring now
3. Featured article or essay
4. Topic hubs
5. Recent writing

The homepage should not be only a chronological blog list. It should function as a curated front page.

## Content model

### Core content types

**Article**
- title
- slug
- summary
- publish date
- tags/topics
- body content
- status
- optional cover image

**Topic**
- title
- slug
- description
- related articles

**Now**
- singleton-style editable document for current focus

**Site settings**
- homepage introduction
- social links
- SEO defaults
- optional navigation labels

### Optional future content types

- curated work/experiments
- short notes
- reading notes

These are optional and should not block the first version.

## Key content decisions

- Remove GitHub-driven project fetching entirely.
- Do not structure the site around repository activity.
- If work/experiments are introduced later, they should be manually curated and editorially framed.

## Visual direction

The approved visual/product direction is:

**Analyst Journal with Guidebook structure**

This means:

- the site should feel thoughtful and credible
- the writing should feel personal and authored
- the structure should make exploration easy
- the interface should support reading and topic discovery rather than portfolio showcasing

The site should balance:

- **voice**: clear author perspective
- **structure**: useful topic pathways and archives

## Migration strategy

- Build the new site alongside the current one.
- Keep the current production site stable until the new version is ready.
- Migrate selected existing posts worth keeping into the new system.
- Retire the old local Express CMS from the main workflow.
- Retire the GitHub-project-fetch concept completely.

This is a rebuild, not an in-place refactor.

## Delivery workflow

- Redesign work must happen on a non-`master` branch.
- `master` remains the production branch.
- Cloudflare Pages production should update only when changes are intentionally merged to `master`.
- Preview deployments should be used for review during redesign work.

This constraint is part of the design, not just a coding preference.

## Success criteria

The redesign is successful when:

- the site clearly reads as a technology/AI/SME analysis publication with personal voice
- publishing a new article is easy in a browser and does not require manual Git workflow
- the public site remains static, fast, and deployable through Cloudflare Pages
- the information architecture helps users discover content by both topic and recency
- the old custom build/admin experience is no longer the primary authoring path

## Phase recommendation

Implementation should be planned as a new-site build with clear phases, likely starting with:

1. architecture and platform setup
2. design system and page shell
3. CMS schema and content modeling
4. article/topic rendering
5. migration of selected content
6. deployment and preview workflow

The implementation plan should be created separately after this spec is accepted.
