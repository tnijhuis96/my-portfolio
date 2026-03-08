const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const action = process.argv[2] || "status";
const projectDir = path.join(__dirname, "..");
const userUnitDir = path.join(os.homedir(), ".config", "systemd", "user");
const serviceName = "my-portfolio-weekly-backup.service";
const timerName = "my-portfolio-weekly-backup.timer";
const servicePath = path.join(userUnitDir, serviceName);
const timerPath = path.join(userUnitDir, timerName);
const onCalendar =
    process.env.SYSTEMD_WEEKLY_BACKUP_ONCALENDAR || "Sun *-*-* 03:00:00";

const serviceUnit = `[Unit]
Description=My Portfolio weekly posts backup

[Service]
Type=oneshot
WorkingDirectory=${projectDir}
ExecStart=/usr/bin/env npm run backup:posts
`;

const timerUnit = `[Unit]
Description=Weekly backup timer for My Portfolio posts

[Timer]
OnCalendar=${onCalendar}
Persistent=true
Unit=${serviceName}

[Install]
WantedBy=timers.target
`;

function run(command) {
    return execSync(command, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: "/bin/bash"
    }).trim();
}

function ensureSystemdUserAvailable() {
    try {
        run("command -v systemctl");
    } catch {
        throw new Error("systemctl is not available on this system.");
    }

    try {
        run("systemctl --user is-system-running || true");
    } catch {
        throw new Error(
            "systemd user manager is not available. Log into a graphical session or enable user services."
        );
    }
}

function writeUnits() {
    fs.mkdirSync(userUnitDir, { recursive: true });
    fs.writeFileSync(servicePath, serviceUnit);
    fs.writeFileSync(timerPath, timerUnit);
}

function installTimer() {
    ensureSystemdUserAvailable();
    writeUnits();

    run("systemctl --user daemon-reload");
    run(`systemctl --user enable --now ${timerName}`);

    console.log("✅ Weekly backup systemd timer installed.");
    console.log(`OnCalendar: ${onCalendar}`);
    console.log(`Timer: ${timerName}`);
}

function removeTimer() {
    ensureSystemdUserAvailable();

    try {
        run(`systemctl --user disable --now ${timerName}`);
    } catch {
    }

    if (fs.existsSync(timerPath)) {
        fs.unlinkSync(timerPath);
    }

    if (fs.existsSync(servicePath)) {
        fs.unlinkSync(servicePath);
    }

    run("systemctl --user daemon-reload");

    console.log("✅ Weekly backup systemd timer removed.");
}

function timerStatus() {
    ensureSystemdUserAvailable();

    const timerExists = fs.existsSync(timerPath);
    const serviceExists = fs.existsSync(servicePath);

    if (!timerExists || !serviceExists) {
        console.log("ℹ️ Weekly backup systemd timer is not installed.");
        return;
    }

    let enabled = "unknown";
    let active = "unknown";
    let next = "n/a";

    try {
        enabled = run(`systemctl --user is-enabled ${timerName}`);
    } catch {
        enabled = "disabled";
    }

    try {
        active = run(`systemctl --user is-active ${timerName}`);
    } catch {
        active = "inactive";
    }

    try {
        next = run(
            `systemctl --user show ${timerName} --property=NextElapseUSecRealtime --value`
        );
    } catch {
        next = "n/a";
    }

    console.log("✅ Weekly backup systemd timer is installed.");
    console.log(`Enabled: ${enabled}`);
    console.log(`Active: ${active}`);
    console.log(`OnCalendar: ${onCalendar}`);
    console.log(`Next run: ${next || "n/a"}`);
}

try {
    if (action === "install") {
        installTimer();
    } else if (action === "remove") {
        removeTimer();
    } else if (action === "status") {
        timerStatus();
    } else {
        throw new Error("Invalid action. Use: install | remove | status");
    }
} catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
}
