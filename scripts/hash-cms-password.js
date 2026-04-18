const bcrypt = require("bcryptjs");

function readPasswordFromPipe() {
  return new Promise((resolve, reject) => {
    const chunks = [];

    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

function promptForPassword(promptText) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const promptOutput = process.stderr;
    let password = "";

    function cleanup() {
      stdin.removeListener("data", onData);
      stdin.removeListener("error", onError);

      if (stdin.isTTY) {
        stdin.setRawMode(false);
      }
    }

    function finish() {
      cleanup();
      promptOutput.write("\n");
      resolve(password);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onData(chunk) {
      const value = chunk.toString("utf8");

      if (value === "\u0003") {
        cleanup();
        promptOutput.write("\n");
        process.exit(1);
      }

      if (value === "\r" || value === "\n") {
        finish();
        return;
      }

      if (value === "\u0008" || value === "\u007f") {
        password = password.slice(0, -1);
        return;
      }

      password += value;
    }

    promptOutput.write(promptText);

    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
    stdin.on("error", onError);
  });
}

async function readPassword() {
  if (process.argv.length > 2) {
    throw new Error(
      "Pass the password via stdin instead of process arguments to avoid leaking secrets.",
    );
  }

  if (process.stdin.isTTY) {
    return promptForPassword("Enter CMS password: ");
  }

  return readPasswordFromPipe();
}

async function main() {
  const password = (await readPassword()).replace(/[\r\n]+$/, "");

  if (!password) {
    console.error(
      "Provide the password via stdin, for example: printf 'your-password' | npm run --silent cms:hash-password",
    );
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  console.log(hash);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
