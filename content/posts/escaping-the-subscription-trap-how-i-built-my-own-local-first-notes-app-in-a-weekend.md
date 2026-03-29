---
title: >-
  Escaping the Subscription Trap: How I Built My Own Local-First Notes App in a
  Weekend
description: Next target in my software dev journey
date: '2026-03-29T17:40:10.837Z'
status: published
tags: []
publishAt: '2026-03-29'
---
Let’s be honest: the modern software landscape is exhausting. I reached my breaking point this week. Every note-taking app I tried either demanded a $10 monthly tribute, locked my data behind an “always-online” cloud wall, or aggressively offered an AI assistant to “rewrite my thoughts.” I didn't want an ecosystem. I just wanted a fast, reliable place to write things down.

So, I did what any stubbornly optimistic developer would do: I closed my wallet, opened my terminal, and decided to build my own.

The mission was clear. I needed a lean, multi-platform, local-first notes application. It had to be fast, it had to use standard Markdown files, and it absolutely could not have any bloatware.

Enter my new favorite tech stack: React and Tauri.

If you haven’t played with Tauri yet, you’re missing out. It’s essentially the lean, Rust-powered cousin of Electron. Instead of bundling an entire Chromium browser into the app and eating half your RAM just to display text, Tauri uses your operating system's native web engine. You get to write your UI in React, but the resulting native desktop app is blazing fast and incredibly lightweight.

Of course, the journey wasn't without a few boss fights. The biggest hurdle was wrestling with Tauri’s V2 security model. Because Tauri is designed to be hyper-secure, it acts like an overzealous nightclub bouncer. By default, it blocks your frontend from touching anything on your hard drive. I spent a solid chunk of time dialing in granular Rust capabilities just to let my app read a folder or rename a file without triggering a security lockdown. But once I figured out how to use the Persisted Scope plugin—granting access to just my notes folder without compromising the rest of my machine—it was smooth sailing.

From there, the app practically built itself. I wired up a Markdown rendering engine so I could toggle between raw text and beautifully formatted notes. I added a custom auto-save feature with debouncing, ensuring my hard drive didn't spin up on every single keystroke. I even built in native OS warning prompts to stop me from accidentally deleting my own files.

But my absolute favorite feature? The "Sync Engine."

There is no database. There is no backend. The app just reads and writes plain .md files directly to a local OneDrive folder on my MacBook. The OS handles all the syncing in the background for free. When I boot up my Ubuntu machine for coding, I just compile the exact same codebase into a .deb executable, point it at that same folder, and boom—instant, flawless syncing.

The moment I ran the final npm run tauri build command and dragged that shiny, compiled .app file into my Mac’s dock, it felt like magic. I completely reclaimed my digital sovereignty. I own the code, I own the files, and nobody is charging me a monthly fee to access my own thoughts.

If you’re feeling the "bloatware fatigue," I highly recommend taking a weekend to build your own daily-driver tools. It is incredibly rewarding.

Now, if you'll excuse me, I have some notes to take!
