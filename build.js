const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const srcDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");

const postsDir = path.join(srcDir, "posts");
const pagesDir = path.join(srcDir, "pages");
const templatesDir = path.join(srcDir, "templates");
const cssDir = path.join(srcDir, "css");

const layout = fs.readFileSync(
    path.join(templatesDir, "layout.html"),
    "utf-8"
);

// Clear dist
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir);

// Copy CSS
fs.mkdirSync(path.join(distDir, "css"));
fs.copyFileSync(
    path.join(cssDir, "style.css"),
    path.join(distDir, "css/style.css")
);

function applyLayout(title, content) {
    return layout
        .replace("{{title}}", title)
        .replace("{{content}}", content);
}

/* =========================
   GENERATE STATIC PAGES
========================= */

const pages = fs.readdirSync(pagesDir);

pages.forEach(page => {
    const raw = fs.readFileSync(
        path.join(pagesDir, page),
        "utf-8"
    );

    const finalHtml = applyLayout(
        page.replace(".html", ""),
        raw
    );

    fs.writeFileSync(
        path.join(distDir, page),
        finalHtml
    );

    console.log(`Generated page: ${page}`);
});

/* =========================
   GENERATE BLOG POSTS
========================= */

const blogDir = path.join(distDir, "blog");
fs.mkdirSync(blogDir);

const postTemplate = fs.readFileSync(
    path.join(templatesDir, "post.html"),
    "utf-8"
);

const files = fs.readdirSync(postsDir);
let postsMeta = [];

files.forEach(file => {
    const raw = fs.readFileSync(
        path.join(postsDir, file),
        "utf-8"
    );

    const [_, frontmatter, content] = raw.split("---");

    const meta = {};
    frontmatter.split("\n").forEach(line => {
        const [key, value] = line.split(":").map(s => s.trim());
        if (key && value) meta[key] = value;
    });

    const htmlContent = marked(content);

    const postHtml = postTemplate
        .replace("{{title}}", meta.title)
        .replace("{{content}}", htmlContent);

    const finalHtml = applyLayout(meta.title, postHtml);

    const outputFileName = file.replace(".md", ".html");

    fs.writeFileSync(
        path.join(blogDir, outputFileName),
        finalHtml
    );

    postsMeta.push({
        title: meta.title,
        date: meta.date,
        description: meta.description,
        slug: outputFileName
    });

    console.log(`Generated post: ${outputFileName}`);
});

// Sort newest first
postsMeta.sort((a, b) => new Date(b.date) - new Date(a.date));

// Generate blog index
const blogListHtml = postsMeta.map(post => `
<article>
    <h2>${post.title}</h2>
    <p>${post.date}</p>
    <p>${post.description}</p>
    <a href="/blog/${post.slug}">Read More</a>
</article>
`).join("");

const blogIndex = applyLayout(
    "Blog",
    `<h1>Blog</h1>${blogListHtml}`
);

fs.writeFileSync(
    path.join(blogDir, "index.html"),
    blogIndex
);

console.log("Generated blog index.");