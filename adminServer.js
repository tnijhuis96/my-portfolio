require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("admin"));

app.post("/create-post", (req, res) => {
    const { title, description, content, tags } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required." });
    }

    // Generate slug
    const slug = title
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

    const postsDir = path.join(__dirname, "content/posts");

    if (!fs.existsSync(postsDir)) {
        fs.mkdirSync(postsDir, { recursive: true });
    }

    const filePath = path.join(postsDir, `${slug}.md`);

    fs.writeFileSync(filePath, fileContent);

    res.json({ success: true, message: "Post created successfully!" });
});

app.listen(3001, () => {
    console.log("CMS running at http://localhost:3001");
});