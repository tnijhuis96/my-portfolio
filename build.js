require("dotenv").config();
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

// =============================
// Environment Validation
// =============================
function validateProjectsEnvironment() {
    if (!process.env.GITHUB_USERNAME) {
        throw new Error(
            "GITHUB_USERNAME is required to build projects from GitHub. Set it in your environment or .env file."
        );
    }

    if (!process.env.GITHUB_TOKEN) {
        console.warn(
            "⚠️ No GITHUB_TOKEN provided. Falling back to unauthenticated GitHub requests (rate limit: 60/hour)."
        );
    }
}

// Ensure fetch is available (Node < 18)
if (typeof fetch === "undefined") {
    global.fetch = (...args) =>
        import("node-fetch").then(({ default: fetch }) => fetch(...args));
}

// =============================
// Paths
// =============================
const srcDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");
const postsDir = path.join(__dirname, "content/posts");
const legacyPostsDir = path.join(srcDir, "posts");
const pagesDir = path.join(srcDir, "pages");
const templatesDir = path.join(srcDir, "templates");
const cssDir = path.join(srcDir, "css");

function assertCanonicalPostSource() {
    if (!fs.existsSync(legacyPostsDir)) {
        return;
    }

    const legacyPostFiles = fs
        .readdirSync(legacyPostsDir)
        .filter(file => file.endsWith(".md"));

    if (legacyPostFiles.length > 0) {
        throw new Error(
            `Legacy markdown files found in src/posts (${legacyPostFiles.join(
                ", "
            )}). Move all posts to content/posts and remove legacy files.`
        );
    }
}

// =============================
// SEO
// =============================
const SITE_URL = (process.env.SITE_URL || "https://urban-explore.com").replace(/\/$/, "");
const POSTS_PER_PAGE = parseInt(process.env.POSTS_PER_PAGE || "5", 10);

// =============================
// Utilities
// =============================
function applyLayout(layout, title, content, basePath = "", headMeta = "") {
    return layout
        .replace("{{title}}", title)
        .replaceAll("{{basePath}}", basePath)
        .replace("{{content}}", content)
        .replace("{{headMeta}}", headMeta);
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "Undated";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Undated";
    }

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function estimateReadTime(markdownContent) {
    const wordCount = markdownContent.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(wordCount / 220));
    return `${minutes} min read`;
}

function slugify(tag) {
    return tag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

async function fetchGitHubRepos() {
    const headers = {
        Accept: "application/vnd.github+json"
    };

    if (process.env.GITHUB_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(
        `https://api.github.com/users/${process.env.GITHUB_USERNAME}/repos`,
        { headers }
    );

    if (!response.ok) {
        throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`
        );
    }

    const repos = await response.json();

    return repos
        .filter(repo => !repo.fork)
        .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
}

// =============================
// Main Build Function
// =============================
async function build() {
    console.log("🚀 Starting build...");
    assertCanonicalPostSource();

    // Load layout once
    const layout = fs.readFileSync(
        path.join(templatesDir, "layout.html"),
        "utf-8"
    );

    // Clear dist safely
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    // Copy CSS
    fs.mkdirSync(path.join(distDir, "css"), { recursive: true });
    fs.copyFileSync(
        path.join(cssDir, "style.css"),
        path.join(distDir, "css/style.css")
    );

    // Copy public/ static assets (ads.txt, robots.txt, etc.)
    const publicDir = path.join(__dirname, "public");
    if (fs.existsSync(publicDir)) {
        fs.readdirSync(publicDir).forEach(file => {
            fs.copyFileSync(
                path.join(publicDir, file),
                path.join(distDir, file)
            );
            console.log(`Copied public asset: ${file}`);
        });
    }

    /* =========================
       GENERATE STATIC PAGES
    ========================= */

    if (fs.existsSync(pagesDir)) {
        const pages = fs.readdirSync(pagesDir);

        pages.forEach(page => {
            const raw = fs.readFileSync(
                path.join(pagesDir, page),
                "utf-8"
            );

            const pageUrl = page === "index.html"
                ? `${SITE_URL}/`
                : `${SITE_URL}/${page}`;
            let pageHeadMeta = `<link rel="canonical" href="${pageUrl}">`;

            if (page === "search.html") {
                pageHeadMeta += `\n    <link href="/pagefind/pagefind-ui.css" rel="stylesheet">`;
            }

            const finalHtml = applyLayout(
                layout,
                page.replace(".html", ""),
                raw,
                "",
                pageHeadMeta
            );

            fs.writeFileSync(
                path.join(distDir, page),
                finalHtml
            );

            console.log(`Generated page: ${page}`);
        });
    }

    /* =========================
       GENERATE BLOG POSTS
    ========================= */

    const blogDir = path.join(distDir, "blog");
    fs.mkdirSync(blogDir, { recursive: true });

    const postTemplate = fs.readFileSync(
        path.join(templatesDir, "post.html"),
        "utf-8"
    );

    const files = fs.existsSync(postsDir)
        ? fs.readdirSync(postsDir)
        : [];

    const tagMap = {};
    let postsMeta = [];

    files.forEach(file => {
        const fileContent = fs.readFileSync(
            path.join(postsDir, file),
            "utf-8"
        );

        const { data, content } = matter(fileContent);

        // Skip drafts
        if (data.status !== "published") return;

        // W7: warn on missing description
        if (!data.description) {
            console.warn(`⚠️  Post "${file}" is missing a description. Add one for better SEO.`);
        }

        const htmlContent = marked(content);
        const formattedDate = formatDate(data.date);
        const readingTime = estimateReadTime(content);
        const isoDate = data.date ? new Date(data.date).toISOString() : "";
        const slug = file.replace(".md", "");
        const postUrl = `${SITE_URL}/blog/${slug}.html`;

        // W5: OG + Twitter card meta (HTML-escaped attribute values)
        const escapedTitle = (data.title || "Untitled")
            .replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const escapedDesc = (data.description || "")
            .replace(/&/g, "&amp;").replace(/"/g, "&quot;");

        // W6: JSON-LD Article schema (serialised safely via JSON.stringify)
        const jsonLd = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": data.title || "Untitled",
            "description": data.description || "",
            "url": postUrl,
            "datePublished": isoDate,
            "author": { "@type": "Person", "name": "Thomas Nijhuis" }
        });

        const postHeadMeta = [
            `<link rel="canonical" href="${postUrl}">`,
            `<meta property="og:type" content="article">`,
            `<meta property="og:title" content="${escapedTitle}">`,
            `<meta property="og:description" content="${escapedDesc}">`,
            `<meta property="og:url" content="${postUrl}">`,
            `<meta property="og:site_name" content="Thomas Nijhuis">`,
            `<meta name="twitter:card" content="summary">`,
            `<meta name="twitter:title" content="${escapedTitle}">`,
            `<meta name="twitter:description" content="${escapedDesc}">`,
            `<script type="application/ld+json">${jsonLd}</script>`
        ].join("\n    ");

        const tags = Array.isArray(data.tags) ? data.tags : [];
        const tagSlugs = tags.map(slugify);
        const tagPillsHtml = tags.length > 0
            ? `<div class="post-tags">${tags.map((tag, i) => `<a class="tag-pill" href="/tags/${tagSlugs[i]}/">${tag.replace(/&/g, "&amp;")}</a>`).join("")}</div>`
            : "";

        const postHtml = postTemplate
            .replace("{{title}}", data.title || "Untitled")
            .replace("{{description}}", data.description || "")
            .replace("{{date}}", formattedDate)
            .replace("{{readingTime}}", readingTime)
            .replace("{{tags}}", tagPillsHtml)
            .replace("{{content}}", htmlContent);

        const finalHtml = applyLayout(
            layout,
            data.title || "Untitled",
            postHtml,
            "../",
            postHeadMeta
        );

        const outputFileName = file.replace(".md", ".html");

        fs.writeFileSync(
            path.join(blogDir, outputFileName),
            finalHtml
        );

        // W8: extended postsMeta with isoDate, url, tags
        const postMeta = {
            title: data.title || "Untitled",
            date: data.date || "",
            isoDate,
            formattedDate,
            description: data.description || "",
            readingTime,
            url: postUrl,
            slug: outputFileName,
            tags,
            tagSlugs
        };
        postsMeta.push(postMeta);

        tags.forEach((tag, i) => {
            const tagSlug = tagSlugs[i];
            if (!tagMap[tagSlug]) {
                tagMap[tagSlug] = { label: tag, posts: [] };
            }
            tagMap[tagSlug].posts.push(postMeta);
        });

        console.log(`Generated post: ${outputFileName}`);
    });

    // Sort newest first (safe date handling)
    postsMeta.sort(
        (a, b) =>
            new Date(b.date || 0) - new Date(a.date || 0)
    );

    const additionalSitemapUrls = [];

    /* =========================
       BLOG TEASER HELPER
    ========================= */

    function buildTeaserHtml(post) {
        const pillsHtml = post.tags.length > 0
            ? `\n    <div class="blog-teaser-tags">${post.tags.map((tag, i) => `<a class="tag-pill" href="/tags/${post.tagSlugs[i]}/">${tag.replace(/&/g, "&amp;")}</a>`).join("")}</div>`
            : "";
        return `
<article class="blog-teaser">
    <div class="blog-teaser-top">
        <h2>${post.title}</h2>
        <div class="blog-teaser-meta">
            <span>${post.formattedDate}</span>
            <span>${post.readingTime}</span>
        </div>
    </div>${pillsHtml}
    <p>${post.description || "No summary provided yet."}</p>
    <a href="${post.url}" class="btn-small">Read Article</a>
</article>`;
    }

    /* =========================
       GENERATE BLOG INDEX (PAGINATED)
    ========================= */

    const totalPages = Math.max(1, Math.ceil(postsMeta.length / POSTS_PER_PAGE));

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const start = (pageNum - 1) * POSTS_PER_PAGE;
        const pagePosts = postsMeta.slice(start, start + POSTS_PER_PAGE);
        const pageListHtml = pagePosts.map(buildTeaserHtml).join("");

        const hasPrev = pageNum > 1;
        const hasNext = pageNum < totalPages;
        const prevHref = pageNum === 2 ? "/blog/" : `/blog/page/${pageNum - 1}/`;
        const nextHref = `/blog/page/${pageNum + 1}/`;

        const paginationHtml = `
<nav class="pagination" aria-label="Blog page navigation">
    <a class="pagination-btn"${hasPrev ? ` href="${prevHref}"` : ' aria-disabled="true"'}>&larr; Newer</a>
    <span class="pagination-info">Page ${pageNum} of ${totalPages}</span>
    <a class="pagination-btn"${hasNext ? ` href="${nextHref}"` : ' aria-disabled="true"'}>Older &rarr;</a>
</nav>`;

        const isFirstPage = pageNum === 1;
        const pageCanonical = isFirstPage
            ? `${SITE_URL}/blog/`
            : `${SITE_URL}/blog/page/${pageNum}/`;
        const blogPageHeadMeta = `<link rel="canonical" href="${pageCanonical}">`;
        const pageBasePath = isFirstPage ? "../" : "../../../";

        const blogIndexHtml = applyLayout(
            layout,
            "Blog",
            `<section class="blog-index"><h1>Blog</h1><p class="blog-index-intro">Thoughts, project breakdowns, and lessons from shipping software every week.</p>${pageListHtml}${paginationHtml}</section>`,
            pageBasePath,
            blogPageHeadMeta
        );

        if (isFirstPage) {
            fs.writeFileSync(path.join(blogDir, "index.html"), blogIndexHtml);
            console.log("Generated blog index (page 1).");
        } else {
            const pageDir = path.join(blogDir, "page", String(pageNum));
            fs.mkdirSync(pageDir, { recursive: true });
            fs.writeFileSync(path.join(pageDir, "index.html"), blogIndexHtml);
            console.log(`Generated blog index page ${pageNum}.`);
            additionalSitemapUrls.push({
                loc: pageCanonical,
                priority: "0.6",
                changefreq: "daily",
                lastmod: ""
            });
        }
    }

    /* =========================
       GENERATE TAG PAGES
    ========================= */

    const tagsDir = path.join(distDir, "tags");
    fs.mkdirSync(tagsDir, { recursive: true });

    Object.entries(tagMap).forEach(([slug, { label, posts: tagPosts }]) => {
        const tagPostsHtml = tagPosts.map(buildTeaserHtml).join("");
        const tagHeadMeta = `<link rel="canonical" href="${SITE_URL}/tags/${slug}/">`;
        const tagSlugDir = path.join(tagsDir, slug);
        fs.mkdirSync(tagSlugDir, { recursive: true });

        const tagPageHtml = applyLayout(
            layout,
            `#${label}`,
            `<section class="tag-index-page"><div class="container"><h1>#${label.replace(/&/g, "&amp;")}</h1><p class="tag-index-intro">${tagPosts.length} post${tagPosts.length === 1 ? "" : "s"} tagged <strong>${label.replace(/&/g, "&amp;")}</strong>.</p>${tagPostsHtml}</div></section>`,
            "../../",
            tagHeadMeta
        );

        fs.writeFileSync(path.join(tagSlugDir, "index.html"), tagPageHtml);
        console.log(`Generated tag page: /tags/${slug}/`);

        additionalSitemapUrls.push({
            loc: `${SITE_URL}/tags/${slug}/`,
            priority: "0.5",
            changefreq: "weekly",
            lastmod: ""
        });
    });

    // All-tags overview page
    const allTagsHeadMeta = `<link rel="canonical" href="${SITE_URL}/tags/">`;
    const allTagPillsHtml = Object.entries(tagMap)
        .sort(([, a], [, b]) => b.posts.length - a.posts.length)
        .map(([slug, { label, posts: tagPosts }]) =>
            `<a class="tag-pill" href="/tags/${slug}/">${label.replace(/&/g, "&amp;")}<span class="tag-count">(${tagPosts.length})</span></a>`
        )
        .join("");

    const allTagsPageHtml = applyLayout(
        layout,
        "Tags",
        `<section class="all-tags-index"><div class="container"><h1>Tags</h1><p class="all-tags-intro">Browse posts by topic.</p><div class="all-tags-grid">${allTagPillsHtml}</div></div></section>`,
        "../",
        allTagsHeadMeta
    );

    fs.writeFileSync(path.join(tagsDir, "index.html"), allTagsPageHtml);
    console.log("Generated tags overview page.");

    additionalSitemapUrls.push({
        loc: `${SITE_URL}/tags/`,
        priority: "0.6",
        changefreq: "weekly",
        lastmod: ""
    });



    /* =========================
       GENERATE PROJECTS
    ========================= */

     validateProjectsEnvironment();

    const repos = await fetchGitHubRepos();

    const projectCards = repos
        .slice(0, 6)
        .map(
            repo => `
<div class="project-card">
    <div class="project-card-top">
        <h3>${repo.name}</h3>
        <div class="project-meta">
            <span>Language: ${repo.language || "n/a"}</span>
            <span>Stars: ${repo.stargazers_count || 0}</span>
        </div>
    </div>
    <p>${repo.description || "No description provided."}</p>
    <div class="project-card-actions">
        <span class="project-updated">Updated ${formatDate(repo.pushed_at)}</span>
        <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="btn-small">
            Repository
        </a>
    </div>
</div>`
        )
        .join("");

    const projectsPageContent = `
<section class="projects">
    <div class="container">
        <h1>Projects</h1>
        <div class="project-grid">
            ${projectCards}
        </div>
    </div>
</section>`;

    const projectsHtml = applyLayout(
        layout,
        "Projects",
        projectsPageContent,
        ""
    );

    fs.writeFileSync(
        path.join(distDir, "projects.html"),
        projectsHtml
    );

    console.log("Generated projects from GitHub API.");

    /* =========================
       GENERATE RSS FEED
    ========================= */

    const rssItems = postsMeta.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${post.url}</link>
      <guid isPermaLink="true">${post.url}</guid>
      <pubDate>${post.isoDate ? new Date(post.isoDate).toUTCString() : ""}</pubDate>
      <description><![CDATA[${post.description}]]></description>
    </item>`).join("");

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Thomas Nijhuis</title>
    <link>${SITE_URL}/blog/</link>
    <description>Thoughts, project breakdowns, and lessons from shipping software every week.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;

    fs.writeFileSync(path.join(distDir, "feed.xml"), rssXml);
    console.log("Generated feed.xml.");

    /* =========================
       GENERATE SITEMAP
    ========================= */

    const staticUrls = [
        { loc: `${SITE_URL}/`,               priority: "1.0", changefreq: "weekly",  lastmod: "" },
        { loc: `${SITE_URL}/projects.html`,   priority: "0.8", changefreq: "weekly",  lastmod: "" },
        { loc: `${SITE_URL}/blog/`,           priority: "0.9", changefreq: "daily",   lastmod: "" },
        { loc: `${SITE_URL}/now.html`,        priority: "0.7", changefreq: "monthly", lastmod: "" },
        { loc: `${SITE_URL}/search.html`,     priority: "0.5", changefreq: "monthly", lastmod: "" }
    ];
    const postUrls = postsMeta.map(post => ({
        loc: post.url,
        priority: "0.7",
        changefreq: "monthly",
        lastmod: post.isoDate ? post.isoDate.slice(0, 10) : ""
    }));

    const sitemapEntries = [...staticUrls, ...postUrls, ...additionalSitemapUrls].map(u => `
  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
  </url>`).join("");

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>`;

    fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemapXml);
    console.log("Generated sitemap.xml.");

    console.log("✅ Build complete.");
}

// Run build
build().catch(err => {
    console.error("❌ Build failed:", err.message);
    process.exit(1);
});