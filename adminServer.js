require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { exec } = require("child_process");

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.static("admin"));

// Ensure posts directory exists
const postsDir = path.join(__dirname, "content/posts");

if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
}

/* =========================
   Helper: Get All Posts
========================= */
function getAllPosts() {
    const files = fs.readdirSync(postsDir);

    return files.map(file => {
        const filePath = path.join(postsDir, file);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const { data } = matter(fileContent);

        return {
            slug: file.replace(".md", ""),
            title: data.title || "Untitled",
            date: data.date || "",
            description: data.description || ""
        };
    });
}

/* =========================
   GET All Posts
========================= */
app.get("/posts", (req, res) => {
    const posts = getAllPosts();
    res.json(posts);
});

/* =========================
   GET Single Post
========================= */
app.get("/posts/:slug", (req, res) => {
    const slug = req.params.slug;
    const filePath = path.join(postsDir, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Post not found" });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    res.json({
        slug,
        title: data.title || "",
        description: data.description || "",
        date: data.date || "",
        tags: data.tags || "",
        content
    });
});

/* =========================
   CREATE or UPDATE Post
========================= */
app.post("/save-post", (req, res) => {
    const { slug, title, description, content, tags } = req.body;

    if (!title || !content) {
        return res.status(400).json({
            error: "Title and content are required."
        });
    }

    // Generate slug if new post
    const finalSlug = slug
        ? slug
        : title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "");

    const fileContent = `---
title: "${title}"
description: "${description || ""}"
date: "${new Date().toISOString()}"
tags: [${tags || ""}]
---

${content}
`;

    const filePath = path.join(postsDir, `${finalSlug}.md`);

    fs.writeFileSync(filePath, fileContent);

    // Automatically rebuild site
    exec("npm run build", (error) => {
        if (error) {
            console.error("Build failed:", error);
            return res.status(500).json({
                error: "Post saved but build failed."
            });
        }

        console.log("Site rebuilt successfully.");
        res.json({
            success: true,
            slug: finalSlug
        });
    });
});

/* =========================
   Start Server
========================= */
app.listen(PORT, () => {
    console.log(`CMS running at http://localhost:${PORT}`);
});