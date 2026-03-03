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
        cookie: { secure: false } // true only in HTTPS production
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
// Protected Routes
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
            description: data.description || ""
        };
    });
}

app.get("/posts", requireAuth, (req, res) => {
    res.json(getAllPosts());
});

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

app.post("/save-post", requireAuth, (req, res) => {
    const { slug, title, description, content, tags } = req.body;

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
// Serve Admin UI (Protected)
// =====================
app.get("/", (req, res) => {
    if (req.session.authenticated) {
        return res.redirect("/admin");
    }
    res.sendFile(path.join(__dirname, "admin/login.html"));
});

// Serve Admin Panel (Protected)
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