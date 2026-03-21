---
title: 'From Zero to Scaffold: Urban Explorer Takes Its First Steps'
description: Taking the first steps
date: '2026-03-13T18:52:32.825Z'
status: published
tags: []
---

Today marked the a new beginning, Yesterday was a big day for Urban Explorer — the passion project that wants to turn your city into a game. After weeks of planning and laying the conceptual groundwork, the team pushed the first real code to production. Milestone 1 — Project Scaffolding — is complete and merged. Let's talk about what that actually means.

A Blank Slate No More
Every project starts as an idea. Urban Explorer has had a crystal-clear vision from the start: help people explore their city street by street, track every corner they've walked, and compete with friends over who knows their neighbourhood best. But ideas don't ship — architecture does. Yesterday, that gap closed.

Building on Solid Ground
The most important decisions in a project aren't the features — they're the foundations. Yesterday's work was all about making sure every technical choice made over the past weeks is properly expressed in a real, running codebase.

The application is built on a clear server-first architecture. Heavy lifting — data fetching, authentication, business logic — happens on the server, keeping the browser lean and fast. Only the parts of the UI that genuinely need interactivity run on the client. This separation will pay dividends as the product scales: performance stays predictable and security boundaries are always explicit.

Security by Design
One of the most deliberate architectural choices baked in from day one is how the application handles secrets and credentials. There are three tiers of access — a public configuration safe to ship to any browser, a restricted runtime layer for server-side operations, and a privileged admin layer that never leaves the server under any circumstances. These boundaries aren't enforced by convention or good intentions; they're enforced structurally at the integration layer. It's the kind of thing that's invisible when it works and catastrophic when it doesn't.

Data and Persistence
The data layer is designed around a managed cloud database with a clear split between migrations and runtime. Schema changes are versioned and applied deliberately — there's no drift between what the code expects and what the database contains. The runtime connection is pooled for efficiency, while migrations use a direct connection for reliability. Two concerns, two connections, no confusion.

Quality as a Constraint, Not an Afterthought
Perhaps the most architecturally significant thing about yesterday's work is what didn't get deferred: testing and continuous integration. From the very first commit, every change runs through an automated pipeline — code style, type safety, and unit tests all checked in parallel on every push. The architecture of the development workflow is as considered as the architecture of the application itself.

What's Next
With the foundation in place, the team moves into the database schema — defining the core domain model that will power everything Urban Explorer does. The streets, neighbourhoods, walks, and social features all start here.

Yesterday was about making promises to the codebase. Now it's time to keep them.


