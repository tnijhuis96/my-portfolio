const { execSync } = require("child_process");
const path = require("path");

const action = process.argv[2] || "status";
const projectDir = path.join(__dirname, "..");
const cronTag = "# my-portfolio-weekly-backup";
const cronExpression = process.env.WEEKLY_BACKUP_CRON || "0 3 * * 0";
const logFile = path.join(projectDir, "backups", "weekly-backup.log");
const cronCommand = `${cronExpression} cd \"${projectDir}\" && /usr/bin/env npm run backup:posts >> \"${logFile}\" 2>&1 ${cronTag}`;

function hasCrontab() {
    try {
        execSync("command -v crontab", { stdio: "ignore", shell: "/bin/bash" });
        return true;
    } catch {
        return false;
    }
}

function readCrontab() {
    try {
        return execSync("crontab -l", {
            encoding: "utf8",
            shell: "/bin/bash"
        });
    } catch {
        return "";
    }
}

function writeCrontab(content) {
    execSync("crontab -", {
        input: content,
        stdio: ["pipe", "inherit", "inherit"],
        shell: "/bin/bash"
    });
}

function stripManagedEntries(content) {
    return content
        .split("\n")
        .filter(line => !line.includes(cronTag))
        .join("\n")
        .trim();
}

function installWeeklyBackup() {
    const current = readCrontab();
    const cleaned = stripManagedEntries(current);
    const next = [cleaned, cronCommand].filter(Boolean).join("\n") + "\n";

    writeCrontab(next);

    console.log("✅ Weekly backup cron job installed.");
    console.log(`Schedule: ${cronExpression}`);
    console.log(`Command: npm run backup:posts`);
}

function removeWeeklyBackup() {
    const current = readCrontab();
    const cleaned = stripManagedEntries(current);

    if (!current.includes(cronTag)) {
        console.log("ℹ️ No managed weekly backup cron job found.");
        return;
    }

    const next = cleaned ? `${cleaned}\n` : "";
    writeCrontab(next);

    console.log("✅ Weekly backup cron job removed.");
}

function showStatus() {
    const current = readCrontab();
    const line = current
        .split("\n")
        .find(item => item.includes(cronTag));

    if (!line) {
        console.log("ℹ️ Weekly backup cron job is not installed.");
        return;
    }

    console.log("✅ Weekly backup cron job is installed:");
    console.log(line.trim());
}

if (!hasCrontab()) {
    console.error("❌ crontab is not available on this system.");
    process.exit(1);
}

if (action === "install") {
    installWeeklyBackup();
} else if (action === "remove") {
    removeWeeklyBackup();
} else if (action === "status") {
    showStatus();
} else {
    console.error("❌ Invalid action. Use: install | remove | status");
    process.exit(1);
}
