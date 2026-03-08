const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const sourceDir = path.join(rootDir, "content", "posts");
const backupsDir = path.join(rootDir, "backups");

function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function backupPosts() {
    if (!fs.existsSync(sourceDir)) {
        throw new Error("content/posts folder not found.");
    }

    fs.mkdirSync(backupsDir, { recursive: true });

    const destination = path.join(
        backupsDir,
        `posts-backup-${getTimestamp()}`
    );

    fs.cpSync(sourceDir, destination, { recursive: true });

    console.log(`✅ Posts backup created at: ${destination}`);
}

try {
    backupPosts();
} catch (error) {
    console.error(`❌ Backup failed: ${error.message}`);
    process.exit(1);
}
