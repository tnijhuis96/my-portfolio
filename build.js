require('dotenv').config();
function validateEnvironment() {
    if (!process.env.GITHUB_USERNAME) {
        throw new Error("❌ GITHUB_USERNAME missing in environment variables.");
    }

    if (!process.env.GITHUB_TOKEN) {
        console.warn("⚠️ No GITHUB_TOKEN provided. Falling back to unauthenticated GitHub requests (rate limit: 60/hour).");
    }
}
validateEnvironment();
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

// Ensure fetch is available in Node.js (for Node < 18, use node-fetch)
if (typeof fetch === 'undefined') {
    global.fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
}

const srcDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");

const postsDir = path.join(__dirname, "content/posts");
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

async function fetchGitHubRepos() {
    const headers = {
        "Accept": "application/vnd.github+json"
    };

    if (process.env.GITHUB_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(
        `https://api.github.com/users/${process.env.GITHUB_USERNAME}/repos`,
        { headers }
    );

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const repos = await response.json();

    return repos
        .filter(repo => !repo.fork)
        .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
}
function applyLayout(title, content, basePath = "") {
    return layout
        .replace("{{title}}", title)
        .replaceAll("{{basePath}}", basePath)
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
        raw,
        ""
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
    const filePath = path.join(postsDir, file);
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // ✅ Proper frontmatter parsing
    const { data, content } = matter(fileContent);

    const htmlContent = marked(content);

    const postHtml = postTemplate
        .replace("{{title}}", data.title || "Untitled")
        .replace("{{content}}", htmlContent);

    const finalHtml = applyLayout(
        data.title || "Untitled",
        postHtml,
        "../"
    );

    const outputFileName = file.replace(".md", ".html");

    fs.writeFileSync(
        path.join(blogDir, outputFileName),
        finalHtml
    );

    postsMeta.push({
        title: data.title,
        date: data.date,
        description: data.description,
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
    <a href="${post.slug}">Read More</a>
</article>
`).join("");

const blogIndex = applyLayout(
    "Blog",
    `<h1>Blog</h1>${blogListHtml}`,
    "../"
);

fs.writeFileSync(
    path.join(blogDir, "index.html"),
    blogIndex
);

console.log("Generated blog index.");
/* =========================
   GENERATE Projects
========================= */

// Generate project grid from GitHub API
async function generateProjects() {

    const repos = await fetchGitHubRepos();

    const projectCards = repos.slice(0, 6).map(repo => `
        <div class="project-card">
            <h3>${repo.name}</h3>
            <p>${repo.description || "No description provided."}</p>
            <a href="${repo.html_url}" target="_blank" class="btn-small">
                View Repository
            </a>
        </div>
    `).join("");

    const projectsPageContent = `
        <section class="projects">
            <div class="container">
                <h1>Projects</h1>
                <div class="project-grid">
                    ${projectCards}
                </div>
            </div>
        </section>
    `;

    const finalHtml = applyLayout(
        "Projects",
        projectsPageContent,
        ""
    );

    fs.writeFileSync(
        path.join(distDir, "projects.html"),
        finalHtml
    );

    console.log("Generated projects from GitHub API.");
}

(async function build() {
    await generateProjects();
})();

console.log("Reading posts from:", postsDir);
console.log("Files found:", files);