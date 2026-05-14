#!/usr/bin/env node
/**
 * Build the signed sideload-release APK in the adjacent maui repo,
 * upload it as the `apk-latest` asset on the cpp-ide-android GitHub
 * Release, and print the copy-paste download snippet for the blog.
 *
 * Usage:
 *   pnpm upload                       # build + upload
 *   node upload-apk.js                # same
 *   node upload-apk.js --skip-build   # skip gradle; upload the APK
 *                                     # already at DEFAULT_APK
 *   node upload-apk.js <path.apk>     # upload an explicit APK path
 *                                     # (implies --skip-build)
 *
 * URL shape:
 *   https://github.com/<owner>/<repo>/releases/download/<tag>/<asset>
 *
 * We use a stable tag (`apk-latest`) and overwrite its asset via
 * `gh release upload --clobber` on every run, so the URL embedded
 * in content/cpp-ide.md never changes across rebuilds.
 */

import { execFileSync, execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GitHub Release target.
const REPO = "haleemzahid/cpp-ide-android";
const TAG = "apk-latest";
const ASSET_NAME = "cpp-ide.apk";

// Adjacent maui repo on the author's machine. `BUILD_DIR` is where
// we invoke gradle; `DEFAULT_APK` is the artifact the sideload
// release build produces.
const BUILD_DIR = "D:/repos/maui/cpp-ide-android/ide";
const GRADLE_TASK = ":app:assembleSideloadRelease";
const DEFAULT_APK =
    "D:/repos/maui/cpp-ide-android/ide/app/build/outputs/apk/sideload/release/app-sideload-release.apk";

// --- argv parsing -----------------------------------------------------------
// Minimal flag parsing: anything after the script name that isn't a flag is
// treated as an explicit APK path (implies --skip-build); --skip-build on
// its own keeps the default APK path but skips gradle.
const rawArgs = process.argv.slice(2);
const skipBuildFlag = rawArgs.includes("--skip-build");
const positional = rawArgs.filter((a) => !a.startsWith("--"));
const explicitApk = positional[0] ?? null;
const skipBuild = skipBuildFlag || explicitApk !== null;
const apkPath = path.resolve(explicitApk ?? DEFAULT_APK);

function logStep(msg) {
    console.log(`→ ${msg}`);
}

// --- gradle build -----------------------------------------------------------
// Streamed, not captured: a release build is slow (minification + R8 + lint
// vital) and the author wants to see task names scroll by like a normal
// gradle invocation. We pipe stdio directly.
function runGradleBuild() {
    const isWindows = os.platform() === "win32";
    // On Windows, `./gradlew` doesn't resolve — we have to invoke the .bat
    // variant, and we do it via `cmd /c` so the batch shebang works.
    // On POSIX, the wrapper is a shell script we can exec directly.
    const wrapper = isWindows ? "gradlew.bat" : "./gradlew";
    const wrapperPath = path.join(BUILD_DIR, wrapper);
    if (!fs.existsSync(wrapperPath)) {
        throw new Error(`Gradle wrapper not found at ${wrapperPath}`);
    }

    logStep(`Building ${GRADLE_TASK} in ${BUILD_DIR}`);
    console.log(`  (this takes ~5 min cold, ~30s warm)`);

    return new Promise((resolve, reject) => {
        // `shell: true` is needed on Windows so .bat can launch; on POSIX
        // it's harmless and lets the same argv shape work on both.
        const child = spawn(wrapperPath, [GRADLE_TASK], {
            cwd: BUILD_DIR,
            stdio: "inherit",
            shell: isWindows,
        });
        child.on("error", reject);
        child.on("exit", (code, signal) => {
            if (code === 0) resolve();
            else reject(
                new Error(
                    `gradle ${GRADLE_TASK} exited with ` +
                        (signal ? `signal ${signal}` : `code ${code}`),
                ),
            );
        });
    });
}

// --- gh helpers -------------------------------------------------------------
function gh(args) {
    console.log(`  $ gh ${args.join(" ")}`);
    return execFileSync("gh", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
    }).trim();
}

// Returns null when gh exits non-zero — used for "release not found" and
// "asset not found" probes where a failure is expected and not fatal.
function ghSafe(args) {
    try {
        return gh(args);
    } catch {
        return null;
    }
}

// --- upload -----------------------------------------------------------------
function uploadApk() {
    // Fail fast if gh isn't on PATH or isn't logged in — a clear error up
    // front beats a confusing exec failure later.
    try {
        execSync("gh --version", { stdio: "ignore" });
    } catch {
        throw new Error("gh CLI not found. Install from https://cli.github.com/");
    }
    try {
        execSync("gh auth status", { stdio: "ignore" });
    } catch {
        throw new Error("gh is not logged in. Run `gh auth login` first.");
    }

    if (!fs.existsSync(apkPath)) {
        throw new Error(
            `APK not found: ${apkPath}\n` +
                "Drop --skip-build to build it, or pass a path explicitly.",
        );
    }

    const stat = fs.statSync(apkPath);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    logStep(`Publishing ${path.basename(apkPath)} (${sizeMB} MB)`);
    console.log(`  from ${apkPath}`);
    console.log(`  to   ${REPO} @ ${TAG}/${ASSET_NAME}`);

    // Ensure the stable release exists. `release view` exits non-zero when
    // the tag is missing, which is our signal to create it rather than
    // update it.
    const existing = ghSafe(["release", "view", TAG, "-R", REPO]);
    if (!existing) {
        logStep(`Creating release ${TAG}`);
        gh([
            "release", "create", TAG,
            "-R", REPO,
            "--title", "cpp-ide APK (latest)",
            "--notes", "Direct-download APK for https://shahidkhan.dev/cpp-ide. " +
                "Overwritten by scripts/upload-apk/upload-apk.js on each build.",
            "--latest=false",
        ]);
    } else {
        logStep(`Release ${TAG} already exists`);
    }

    // Release-asset URLs on GitHub are keyed off the source filename —
    // `gh release upload path#label` only sets the UI label, not the URL
    // slug. Stage a copy named ASSET_NAME so the public URL stays stable
    // regardless of the upstream APK filename.
    const stagedDir = fs.mkdtempSync(path.join(os.tmpdir(), "apk-"));
    const stagedPath = path.join(stagedDir, ASSET_NAME);
    fs.copyFileSync(apkPath, stagedPath);
    logStep(`Staged as ${stagedPath}`);

    // Best-effort cleanup of a mismatched leftover asset (e.g. from when
    // this script uploaded as `app-debug.apk`). `--clobber` only replaces
    // an asset with the same filename.
    ghSafe([
        "release", "delete-asset", TAG,
        path.basename(apkPath), "-R", REPO, "--yes",
    ]);

    logStep("Uploading asset (this can take a minute or two)…");
    gh(["release", "upload", TAG, stagedPath, "-R", REPO, "--clobber"]);

    const url = `https://github.com/${REPO}/releases/download/${TAG}/${ASSET_NAME}`;
    console.log("");
    console.log("──────────────────────────────────────────────");
    console.log(`Public URL: ${url}`);
    console.log(`Size:       ${sizeMB} MB`);
    console.log("");
    console.log("Markdown snippet for content/cpp-ide.md:");
    console.log(
        `<a href="${url}" download="${ASSET_NAME}" ` +
            `style="display:inline-block;padding:14px 32px;` +
            `background:#007ACC;color:#fff;border-radius:8px;text-decoration:none;` +
            `font-weight:600;font-size:1.1em;margin:16px 0;">Download APK</a>`,
    );

    // Persist the URL so a follow-up script or CI step can substitute
    // it into content/cpp-ide.md without parsing stdout.
    const repoRoot = path.resolve(__dirname, "..", "..");
    const outFile = path.join(repoRoot, ".apk-url.txt");
    fs.writeFileSync(outFile, url + "\n");
    console.log(`\nWrote ${outFile}`);
}

// --- orchestrator -----------------------------------------------------------
async function main() {
    if (skipBuild) {
        logStep(
            explicitApk
                ? `Explicit APK path provided; skipping build`
                : `--skip-build given; using existing ${path.basename(apkPath)}`,
        );
    } else {
        await runGradleBuild();
    }
    uploadApk();
}

main().catch((err) => {
    console.error("\n✗ Publish failed:", err.message ?? err);
    process.exit(1);
});
