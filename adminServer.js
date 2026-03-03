require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { exec } = require("child_process");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3001;

const postsDir = path.join(__dirname, "content/posts");

if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
}

// =====================
// Middleware
// =====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
    })
);

// =====================
// Auth Middleware
// =====================
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    return res.status(401).json({ error: "Unauthorized" });
}

// =====================
// Login Route
// =====================
app.post("/login", async (req, res) => {
    const { password } = req.body;

    const valid = await bcrypt.compare(
        password,
        process.env.CMS_PASSWORD_HASH
    );

    if (!valid) {
        return res.status(401).json({ error: "Invalid password" });
    }

    req.session.authenticated = true;
    res.json({ success: true });
});

// =====================
// Logout
// =====================
app.post("/logout", (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// =====================
// Get All Posts
// =====================
function getAllPosts() {
    const files = fs.readdirSync(postsDir);

    return files.map(file => {
        const fileContent = fs.readFileSync(
            path.join(postsDir, file),
            "utf-8"
        );
        const { data } = matter(fileContent);

        return {
            slug: file.replace(".md", ""),
            title: data.title || "Untitled",
            date: data.date || "",
            description: data.description || "",
            status: data.status || "draft"
        };
    });
}

app.get("/posts", requireAuth, (req, res) => {
    res.json(getAllPosts());
});

// =====================
// Get Single Post
// =====================
app.get("/posts/:slug", requireAuth, (req, res) => {
    const filePath = path.join(postsDir, `${req.params.slug}.md`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Post not found" });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    res.json({
        slug: req.params.slug,
        ...data,
        content
    });
});

// =====================
// Save Post (Draft by Default)
// =====================
app.post("/save-post", requireAuth, (req, res) => {
    const { slug, title, description, content, tags, status } = req.body;

    if (!title || !content) {
        return res.status(400).json({
            error: "Title and content required."
        });
    }

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
status: "${status || "draft"}"
tags: [${tags || ""}]
---

${content}
`;

    fs.writeFileSync(
        path.join(postsDir, `${finalSlug}.md`),
        fileContent
    );

    exec("npm run build", (error) => {
        if (error) {
            return res.status(500).json({
                error: "Build failed."
            });
        }

        res.json({ success: true });
    });
});

// =====================
// Publish Post
// =====================
app.post("/publish/:slug", requireAuth, (req, res) => {
    const filePath = path.join(postsDir, `${req.params.slug}.md`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Post not found" });
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    data.status = "published";
    data.date = new Date().toISOString();

    const updatedContent = matter.stringify(content, data);

    fs.writeFileSync(filePath, updatedContent);

    exec("npm run build", (error) => {
        if (error) {
            return res.status(500).json({ error: "Build failed." });
        }

        res.json({ success: true });
    });
});

// =====================
// Delete Post
// =====================
app.delete("/posts/:slug", requireAuth, (req, res) => {
    const filePath = path.join(postsDir, `${req.params.slug}.md`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Post not found" });
    }

    fs.unlinkSync(filePath);

    exec("npm run build", (error) => {
        if (error) {
            return res.status(500).json({ error: "Build failed." });
        }

        res.json({ success: true });
    });
});

// =====================
// Serve Admin UI
// =====================
app.get("/", (req, res) => {
    if (req.session.authenticated) {
        return res.redirect("/admin");
    }
    res.sendFile(path.join(__dirname, "admin/login.html"));
});

app.get("/admin", (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect("/");
    }
    res.sendFile(path.join(__dirname, "admin/blog-editor.html"));
});

// =====================
// Start Server
// =====================
app.listen(PORT, () => {
    console.log(`CMS running at http://localhost:${PORT}`);
});