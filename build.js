const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const postsDir = path.join(__dirname, "src/posts");
const templatePath = path.join(__dirname, "src/templates/post.html");
const blogIndexTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
<main>
    <section class="blog-page">
        <div class="container">
            <h1>Blog</h1>
            {{posts}}
        </div>
    </section>
</main>
</body>
</html>
`;

const distBlogDir = path.join(__dirname, "dist/blog");
fs.mkdirSync(distBlogDir, { recursive: true });

const template = fs.readFileSync(templatePath, "utf-8");
const files = fs.readdirSync(postsDir);

let postsMeta = [];

files.forEach(file => {
    const filePath = path.join(postsDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");

    const [_, frontmatter, content] = raw.split("---");

    const meta = {};
    frontmatter.split("\n").forEach(line => {
        const [key, value] = line.split(":").map(s => s.trim());
        if (key && value) meta[key] = value;
    });

    const htmlContent = marked(content);

    const finalHtml = template
        .replace("{{title}}", meta.title)
        .replace("{{content}}", htmlContent);

    const outputFileName = file.replace(".md", ".html");
    const outputPath = path.join(distBlogDir, outputFileName);

    fs.writeFileSync(outputPath, finalHtml);

    postsMeta.push({
        title: meta.title,
        date: meta.date,
        description: meta.description,
        slug: outputFileName
    });

    console.log(`Generated post: ${outputFileName}`);
});


// Sort posts by date (newest first)
postsMeta.sort((a, b) => new Date(b.date) - new Date(a.date));


// Generate blog listing
const postsHtml = postsMeta.map(post => `
<article class="blog-preview">
    <h2>${post.title}</h2>
    <p class="post-meta">${post.date}</p>
    <p>${post.description}</p>
    <a href="/blog/${post.slug}" class="btn-small">Read More</a>
</article>
`).join("");

const blogIndexHtml = blogIndexTemplate.replace("{{posts}}", postsHtml);

fs.writeFileSync(
    path.join(distBlogDir, "index.html"),
    blogIndexHtml
);

console.log("Generated blog index.");