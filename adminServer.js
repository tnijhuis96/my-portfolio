require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { exec } = require("child_process");
const session = require("express-session");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const app = express();
const PORT = 3001;
const isProduction = process.env.NODE_ENV === "production";
const loginAttempts = new Map();
const POST_STATUS_DRAFT = "draft";
const POST_STATUS_PUBLISHED = "published";
const VALID_POST_STATUSES = new Set([
    POST_STATUS_DRAFT,
    POST_STATUS_PUBLISHED
]);
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const DEPLOY_MODE = (process.env.DEPLOY_MODE || "none").toLowerCase();
const AUTO_DEPLOY_ON_PUBLISH =
    (process.env.AUTO_DEPLOY_ON_PUBLISH || "true") === "true";
const AUTO_DEPLOY_ON_DELETE =
    (process.env.AUTO_DEPLOY_ON_DELETE || "true") === "true";
const DEPLOY_WEBHOOK_METHOD =
    (process.env.DEPLOY_WEBHOOK_METHOD || "POST").toUpperCase();

const postsDir = path.join(__dirname, "content/posts");

if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
}

function slugifyPostTitle(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function normalizeStatus(value, fallback = POST_STATUS_PUBLISHED) {
    const normalized = typeof value === "string"
        ? value.trim().toLowerCase()
        : "";

    if (VALID_POST_STATUSES.has(normalized)) {
        return normalized;
    }

    return fallback;
}

function normalizeTagList(input) {
    const rawTags = Array.isArray(input)
        ? input
        : String(input || "").split(",");
    const uniqueTags = [];
    const seen = new Set();

    rawTags.forEach(tagValue => {
        const normalized = String(tagValue || "")
            .trim()
            .replace(/\s+/g, " ");

        if (!normalized) {
            return;
        }

        const key = normalized.toLowerCase();

        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        uniqueTags.push(normalized);
    });

    return uniqueTags;
}

function isValidDateOnly(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

function normalizePublishAt(value) {
    const normalized = typeof value === "string" ? value.trim() : "";

    if (!normalized) {
        return "";
    }

    if (!isValidDateOnly(normalized)) {
        throw new Error("publishAt must use YYYY-MM-DD format.");
    }

    return normalized;
}

function getTodayDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function isFuturePublishAt(value) {
    return isValidDateOnly(value) && value > getTodayDateKey();
}

function getDisplayStatus(data) {
    const status = normalizeStatus(data.status);
    const publishAt = isValidDateOnly(data.publishAt) ? data.publishAt : "";

    if (
        status === POST_STATUS_PUBLISHED
        && publishAt
        && isFuturePublishAt(publishAt)
    ) {
        return "scheduled";
    }

    return status;
}

function readPostFile(filePath) {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return matter(fileContent);
}

function getPostSortTime(post) {
    const sortValue = post.publishAt || post.date || "";
    const timestamp = new Date(sortValue || 0).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildPostSummary(file) {
    const { data } = readPostFile(path.join(postsDir, file));
    const status = normalizeStatus(data.status);
    const publishAt = isValidDateOnly(data.publishAt) ? data.publishAt : "";

    return {
        slug: file.replace(".md", ""),
        title: data.title || "Untitled",
        date: data.date || "",
        description: data.description || "",
        status,
        publishAt,
        tags: normalizeTagList(data.tags),
        displayStatus: getDisplayStatus(data),
        isScheduled: status === POST_STATUS_PUBLISHED && Boolean(publishAt) && isFuturePublishAt(publishAt)
    };
}

function getAllTags() {
    const files = fs.readdirSync(postsDir).filter(file => file.endsWith(".md"));
    const tagLookup = new Map();

    files.forEach(file => {
        const { data } = readPostFile(path.join(postsDir, file));

        normalizeTagList(data.tags).forEach(tag => {
            const key = tag.toLowerCase();

            if (!tagLookup.has(key)) {
                tagLookup.set(key, tag);
            }
        });
    });

    return Array.from(tagLookup.values()).sort((left, right) =>
        left.localeCompare(right)
    );
}

function validateServerEnvironment() {
    const missing = [];
    const invalid = [];

    if (!process.env.SESSION_SECRET) {
        missing.push("SESSION_SECRET");
    }

    if (!process.env.CMS_PASSWORD_HASH) {
        missing.push("CMS_PASSWORD_HASH");
    }

    if (!["none", "command", "webhook"].includes(DEPLOY_MODE)) {
        invalid.push(
            "DEPLOY_MODE must be one of: none, command, webhook"
        );
    }

    if (DEPLOY_MODE === "command" && !process.env.DEPLOY_COMMAND) {
        missing.push("DEPLOY_COMMAND (required when DEPLOY_MODE=command)");
    }

    if (DEPLOY_MODE === "webhook" && !process.env.DEPLOY_WEBHOOK_URL) {
        missing.push(
            "DEPLOY_WEBHOOK_URL (required when DEPLOY_MODE=webhook)"
        );
    }

    if (
        DEPLOY_MODE === "webhook" &&
        !["POST", "PUT", "PATCH"].includes(DEPLOY_WEBHOOK_METHOD)
    ) {
        invalid.push(
            "DEPLOY_WEBHOOK_METHOD must be one of: POST, PUT, PATCH"
        );
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variable(s): ${missing.join(", ")}`
        );
    }

    if (invalid.length > 0) {
        throw new Error(`Invalid environment configuration: ${invalid.join("; ")}`);
    }
}

function ensureBuildEnvironment() {
    if (!process.env.GITHUB_USERNAME) {
        throw new Error(
            "Cannot build from CMS because GITHUB_USERNAME is missing. Add it to your environment before saving/publishing/deleting posts."
        );
    }
}

async function runBuild() {
    return new Promise((resolve, reject) => {
        exec("npm run build", (error, stdout, stderr) => {
            if (error) {
                return reject(
                    new Error(
                        (stderr || stdout || error.message || "Build failed").trim()
                    )
                );
            }

            return resolve();
        });
    });
}

async function runDeploy(operation, slug) {
    if (DEPLOY_MODE === "none") {
        return {
            triggered: false,
            mode: DEPLOY_MODE,
            message: "Local mode active: build completed, no deploy triggered."
        };
    }

    if (DEPLOY_MODE === "command") {
        return new Promise((resolve, reject) => {
            exec(process.env.DEPLOY_COMMAND, (error, stdout, stderr) => {
                if (error) {
                    return reject(
                        new Error(
                            `Deploy command failed: ${
                                (stderr || stdout || error.message).trim()
                            }`
                        )
                    );
                }

                return resolve({
                    triggered: true,
                    mode: DEPLOY_MODE,
                    message: "Deploy command completed successfully."
                });
            });
        });
    }

    const payload = {
        event: `cms-${operation}`,
        operation,
        slug: slug || null,
        timestamp: new Date().toISOString()
    };

    const headers = {
        "Content-Type": "application/json"
    };

    if (process.env.DEPLOY_WEBHOOK_SECRET) {
        headers["x-deploy-secret"] = process.env.DEPLOY_WEBHOOK_SECRET;
    }

    const response = await fetch(process.env.DEPLOY_WEBHOOK_URL, {
        method: DEPLOY_WEBHOOK_METHOD,
        headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
            `Deploy webhook failed (${response.status}): ${responseText || response.statusText}`
        );
    }

    return {
        triggered: true,
        mode: DEPLOY_MODE,
        message: "Deploy webhook accepted."
    };
}

async function runBuildAndRespond(res, { deploy, operation, slug }) {
    try {
        await runBuild();

        if (!deploy) {
            return res.json({
                success: true,
                slug,
                deploy: {
                    triggered: false,
                    mode: DEPLOY_MODE,
                    message: "Build completed locally."
                }
            });
        }

        const deployResult = await runDeploy(operation, slug);
        return res.json({ success: true, slug, deploy: deployResult });
    } catch (error) {
        return res.status(500).json({
            error: "Build/deploy failed.",
            details: error.message
        });
    }
}

validateServerEnvironment();

if (typeof fetch === "undefined") {
    global.fetch = (...args) =>
        import("node-fetch").then(({ default: fetchImpl }) => fetchImpl(...args));
}

function getClientIp(req) {
    const forwardedFor = req.headers["x-forwarded-for"];

    if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
        return forwardedFor.split(",")[0].trim();
    }

    return req.ip || req.socket.remoteAddress || "unknown";
}

function getRateLimitRecord(ipAddress) {
    const now = Date.now();
    const existing = loginAttempts.get(ipAddress);

    if (!existing) {
        const record = {
            failedCount: 0,
            windowStartedAt: now,
            lockUntil: 0
        };

        loginAttempts.set(ipAddress, record);
        return record;
    }

    if (now - existing.windowStartedAt > LOGIN_WINDOW_MS) {
        existing.failedCount = 0;
        existing.windowStartedAt = now;
    }

    return existing;
}

function registerFailedLogin(ipAddress) {
    const now = Date.now();
    const record = getRateLimitRecord(ipAddress);

    record.failedCount += 1;

    if (record.failedCount >= LOGIN_MAX_ATTEMPTS) {
        record.lockUntil = now + LOGIN_LOCKOUT_MS;
        record.failedCount = 0;
        record.windowStartedAt = now;
    }
}

function clearLoginFailures(ipAddress) {
    loginAttempts.delete(ipAddress);
}

function checkLoginRateLimit(req, res, next) {
    const ipAddress = getClientIp(req);
    const record = getRateLimitRecord(ipAddress);
    const now = Date.now();

    if (record.lockUntil && record.lockUntil > now) {
        const retryAfterSeconds = Math.ceil((record.lockUntil - now) / 1000);
        return res.status(429).json({
            error: "Too many login attempts. Try again later.",
            retryAfterSeconds
        });
    }

    return next();
}

function ensureCsrfToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }

    return req.session.csrfToken;
}

function requireCsrf(req, res, next) {
    const token = req.get("x-csrf-token");

    if (!token || token !== req.session.csrfToken) {
        return res.status(403).json({ error: "Invalid CSRF token" });
    }

    return next();
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
        cookie: {
            secure: isProduction,
            httpOnly: true,
            sameSite: "lax"
        }
    })
);

app.get("/csrf-token", (req, res) => {
    const csrfToken = ensureCsrfToken(req);
    res.json({ csrfToken });
});

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
app.post("/login", checkLoginRateLimit, requireCsrf, async (req, res) => {
    const { password } = req.body;
    const ipAddress = getClientIp(req);

    const valid = await bcrypt.compare(
        password,
        process.env.CMS_PASSWORD_HASH
    );

    if (!valid) {
        registerFailedLogin(ipAddress);
        return res.status(401).json({ error: "Invalid password" });
    }

    clearLoginFailures(ipAddress);
    req.session.authenticated = true;
    ensureCsrfToken(req);
    res.json({ success: true });
});

// =====================
// Logout
// =====================
app.post("/logout", requireAuth, requireCsrf, (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// =====================
// Get All Posts
// =====================
function getAllPosts() {
    return fs.readdirSync(postsDir)
        .filter(file => file.endsWith(".md"))
        .map(buildPostSummary)
        .sort((left, right) => getPostSortTime(right) - getPostSortTime(left));
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

    const { data, content } = readPostFile(filePath);

    res.json({
        slug: req.params.slug,
        ...data,
        status: normalizeStatus(data.status),
        publishAt: isValidDateOnly(data.publishAt) ? data.publishAt : "",
        tags: normalizeTagList(data.tags),
        displayStatus: getDisplayStatus(data),
        content
    });
});

app.get("/tags/autocomplete", requireAuth, (req, res) => {
    res.json({ tags: getAllTags() });
});

// =====================
// Save Post (Draft by Default)
// =====================
app.post("/save-post", requireAuth, requireCsrf, async (req, res) => {
    const {
        slug,
        title,
        description,
        content,
        tags,
        status,
        publishAt
    } = req.body;

    const safeTitle = typeof title === "string" ? title.trim() : "";
    const safeContent = typeof content === "string" ? content.trim() : "";

    if (!safeTitle || !safeContent) {
        return res.status(400).json({
            error: "Title and content required."
        });
    }

    let normalizedPublishAt;

    try {
        normalizedPublishAt = normalizePublishAt(publishAt);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    const finalSlug = slug
        ? slug
        : slugifyPostTitle(safeTitle);

    if (!finalSlug) {
        return res.status(400).json({ error: "Could not derive a valid slug from the title." });
    }

    const filePath = path.join(postsDir, `${finalSlug}.md`);
    const existingPost = fs.existsSync(filePath)
        ? readPostFile(filePath)
        : { data: {}, content: "" };
    const nextStatus = normalizeStatus(status, POST_STATUS_DRAFT);
    const nextData = {
        ...existingPost.data,
        title: safeTitle,
        description: typeof description === "string" ? description.trim() : "",
        date: existingPost.data.date || new Date().toISOString(),
        status: nextStatus,
        tags: normalizeTagList(tags)
    };

    if (normalizedPublishAt) {
        nextData.publishAt = normalizedPublishAt;
    } else {
        delete nextData.publishAt;
    }

    const nextContent = matter.stringify(`${safeContent}\n`, nextData);

    fs.writeFileSync(
        filePath,
        nextContent
    );

    try {
        ensureBuildEnvironment();
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }

    return runBuildAndRespond(res, {
        deploy: false,
        operation: "save",
        slug: finalSlug
    });
});

// =====================
// Publish Post
// =====================
app.post("/publish/:slug", requireAuth, requireCsrf, async (req, res) => {
    const filePath = path.join(postsDir, `${req.params.slug}.md`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Post not found" });
    }

    const { data, content } = readPostFile(filePath);

    data.status = POST_STATUS_PUBLISHED;

    if (!data.date) {
        data.date = new Date().toISOString();
    }

    if (isFuturePublishAt(data.publishAt)) {
        data.publishAt = getTodayDateKey();
    }

    const updatedContent = matter.stringify(content, data);

    fs.writeFileSync(filePath, updatedContent);

    try {
        ensureBuildEnvironment();
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }

    return runBuildAndRespond(res, {
        deploy: AUTO_DEPLOY_ON_PUBLISH,
        operation: "publish",
        slug: req.params.slug
    });
});

// =====================
// Delete Post
// =====================
app.delete("/posts/:slug", requireAuth, requireCsrf, async (req, res) => {
    const filePath = path.join(postsDir, `${req.params.slug}.md`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Post not found" });
    }

    fs.unlinkSync(filePath);

    try {
        ensureBuildEnvironment();
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }

    return runBuildAndRespond(res, {
        deploy: AUTO_DEPLOY_ON_DELETE,
        operation: "delete",
        slug: req.params.slug
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

app.get("/admin/vendor/marked.min.js", requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "node_modules/marked/marked.min.js"));
});

// =====================
// Start Server
// =====================
app.listen(PORT, () => {
    console.log(`CMS running at http://localhost:${PORT}`);
});