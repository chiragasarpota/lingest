#!/usr/bin/env node

/*
 * lingest CLI entry point.
 * Loads the native Rust module via require("..")
 * and exposes the same options as before.
 */

const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

// Load native Rust module (the package root exports it)
let nativeModule;
try {
  nativeModule = require("..");
} catch (err) {
  console.error("Failed to load native module:", err.message);
  console.error("This platform may not be supported yet.");
  console.error(
    "Supported platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64"
  );
  process.exit(1);
}

const DEFAULT_OUTPUT_FILENAME = "lingest_output.md";
const DEFAULT_IGNORE_GLOBS_FOR_CONTENT = [
  // Python
  "**/*.pyc",
  "**/*.pyo",
  "**/*.pyd",
  "**/__pycache__/**",
  "**/__pycache__",
  "**/.pytest_cache/**",
  "**/.pytest_cache",
  "**/.coverage",
  "**/.tox/**",
  "**/.tox",
  "**/.nox/**",
  "**/.nox",
  "**/.mypy_cache/**",
  "**/.mypy_cache",
  "**/.ruff_cache/**",
  "**/.ruff_cache",
  "**/.hypothesis/**",
  "**/.hypothesis",
  "**/poetry.lock",
  "**/Pipfile.lock",
  "**/*.egg-info/**",
  "**/*.egg-info",
  "**/*.egg",
  "**/*.whl",
  "**/site-packages/**",
  "**/site-packages",

  // JavaScript/Node
  "**/node_modules/**",
  "**/node_modules",
  "**/bower_components/**",
  "**/bower_components",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/.npm/**",
  "**/.npm",
  "**/.yarn/**",
  "**/.yarn",
  "**/.pnpm-store/**",
  "**/.pnpm-store",
  "**/bun.lock",
  "**/bun.lockb",

  // Java
  "**/*.class",
  "**/*.jar",
  "**/*.war",
  "**/*.ear",
  "**/*.nar",
  "**/.gradle/**",
  "**/.gradle",
  "**/build/**",
  "**/build",
  "**/.settings/**",
  "**/.settings",
  "**/.classpath",
  "**/gradle-app.setting",
  "**/*.gradle",
  "**/.project",

  // C/C++
  "**/*.o",
  "**/*.obj",
  "**/*.dll",
  "**/*.dylib",
  "**/*.exe",
  "**/*.lib",
  "**/*.out",
  "**/*.a",
  "**/*.pdb",

  // Swift/Xcode
  "**/.build/**",
  "**/.build",
  "**/*.xcodeproj/**",
  "**/*.xcodeproj",
  "**/*.xcworkspace/**",
  "**/*.xcworkspace",
  "**/*.pbxuser",
  "**/*.mode1v3",
  "**/*.mode2v3",
  "**/*.perspectivev3",
  "**/*.xcuserstate",
  "**/xcuserdata/**",
  "**/xcuserdata",
  "**/.swiftpm/**",
  "**/.swiftpm",

  // Ruby
  "**/*.gem",
  "**/.bundle/**",
  "**/.bundle",
  "**/vendor/bundle/**",
  "**/vendor/bundle",
  "**/Gemfile.lock",
  "**/.ruby-version",
  "**/.ruby-gemset",
  "**/.rvmrc",

  // Rust
  "**/Cargo.lock",
  "**/*.rs.bk",
  "**/target/**",
  "**/target",

  // Go
  "**/pkg/**",
  "**/pkg",
  "**/bin/**",
  "**/bin",

  // .NET/C#
  "**/obj/**",
  "**/obj",
  "**/*.suo",
  "**/*.user",
  "**/*.userosscache",
  "**/*.sln.docstates",
  "**/packages/**",
  "**/packages",
  "**/*.nupkg",

  // Version control
  "**/.git/**",
  "**/.git",
  "**/.svn/**",
  "**/.svn",
  "**/.hg/**",
  "**/.hg",
  "**/.gitignore",
  "**/.gitattributes",
  "**/.gitmodules",

  // Images and media
  "**/*.svg",
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.ico",
  "**/*.pdf",
  "**/*.mov",
  "**/*.mp4",
  "**/*.mp3",
  "**/*.wav",
  "**/*.bmp",
  "**/*.webp",
  "**/*.tiff",
  "**/*.psd",
  "**/*.raw",
  "**/*.heif",
  "**/*.indd",
  "**/*.ai",
  "**/*.eps",
  "**/*.avi",
  "**/*.wmv",
  "**/*.flv",
  "**/*.mkv",
  "**/*.webm",
  "**/*.vob",
  "**/*.ogv",
  "**/*.m4v",
  "**/*.3gp",
  "**/*.3g2",
  "**/*.mpeg",
  "**/*.mpg",
  "**/*.flac",
  "**/*.aac",
  "**/*.ogg",
  "**/*.wma",
  "**/*.m4a",
  "**/*.opus",
  "**/*.aiff",
  "**/*.ape",

  // Virtual environments
  "**/venv/**",
  "**/venv",
  "**/.venv/**",
  "**/.venv",
  "**/env/**",
  "**/env",
  "**/.env",
  "**/virtualenv/**",
  "**/virtualenv",
  "**/.env.local",
  "**/.env.*.local",
  "**/.env.production",

  // IDEs and editors
  "**/.idea/**",
  "**/.idea",
  "**/.vscode/**",
  "**/.vscode",
  "**/.vs/**",
  "**/.vs",
  "**/*.swo",
  "**/*.swn",
  "**/*.swp",
  "**/*.sublime-*",

  // Temporary and cache files
  "**/*.log",
  "**/*.bak",
  "**/*.tmp",
  "**/*.temp",
  "**/.cache/**",
  "**/.cache",
  "**/.sass-cache/**",
  "**/.sass-cache",
  "**/.eslintcache",
  "**/.DS_Store",
  "**/Thumbs.db",
  "**/desktop.ini",
  "**/*.backup",
  "**/*.orig",
  "**/*.rej",
  "**/*~",

  // Build directories and artifacts
  "**/build/**",
  "**/build",
  "**/dist/**",
  "**/dist",
  "**/out/**",
  "**/out",
  "**/coverage/**",
  "**/coverage",
  "**/.next/**",
  "**/.next",
  "**/.nuxt/**",
  "**/.nuxt",
  "**/public/build/**",
  "**/_site/**",
  "**/_site",
  "**/site/**",
  "**/site",
  "**/docs/_build/**",
  "**/.docusaurus/**",
  "**/.docusaurus",

  // Cache directories
  "**/.parcel-cache/**",
  "**/.parcel-cache",
  "**/.webpack/**",
  "**/.webpack",
  "**/.rollup/**",
  "**/.rollup",
  "**/.stylelintcache",
  "**/.rpt2_cache/**",
  "**/.rpt2_cache",
  "**/.pnpm/**",
  "**/.pnpm",
  "**/.rush/**",
  "**/.rush",
  "**/.nyc_output/**",
  "**/.nyc_output",

  // Generated files
  "**/*generated*",
  "**/*gen*",
  "**/*.generated.*",

  // Archives
  "**/*.zip",
  "**/*.tar",
  "**/*.gz",
  "**/*.rar",
  "**/*.7z",
  "**/*.bz2",
  "**/*.xz",
  "**/*.iso",
  "**/*.dmg",
  "**/*.pkg",

  // Documents
  "**/*.doc",
  "**/*.docx",
  "**/*.xls",
  "**/*.xlsx",
  "**/*.ppt",
  "**/*.pptx",
  "**/*.odt",
  "**/*.ods",
  "**/*.odp",

  // Fonts
  "**/*.ttf",
  "**/*.otf",
  "**/*.woff",
  "**/*.woff2",
  "**/*.eot",
  "**/*.fon",
  "**/*.fnt",

  // Databases
  "**/*.db",
  "**/*.sqlite",
  "**/*.sqlite3",
  "**/*.mdb",
  "**/*.accdb",

  // Minified files
  "**/*.min.js",
  "**/*.min.css",

  // Source maps
  "**/*.map",

  // Terraform
  "**/.terraform/**",
  "**/.terraform",
  "**/*.tfstate*",

  // Dependencies in various languages
  "**/vendor/**",
  "**/vendor",
  "**/third_party/**",
  "**/third_party",
  "**/external/**",
  "**/external",

  // Data files
  "**/*.csv",
  "**/*.tsv",
  "**/*data*.json",
  "**/*fixture*.json",
  "**/*mock*.json",
  "**/*.xml",

  // Logs
  "**/logs/**",
  "**/logs",

  // Gitingest
  "**/digest.txt",
];

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options]")
  .option("o", {
    alias: "output",
    describe: "Output file name",
    type: "string",
    default: DEFAULT_OUTPUT_FILENAME,
  })
  .option("i", {
    alias: "ignore",
    describe: "Custom ignore globs (comma-separated)",
    type: "string",
    default: "",
  })
  .option("n", {
    alias: "include",
    describe:
      "Include globs (comma-separated). If set, only these are processed",
    type: "string",
    default: "",
  })
  .option("f", {
    alias: "force",
    describe: "Overwrite existing output file",
    type: "boolean",
    default: false,
  })
  .option("q", {
    alias: "quiet",
    describe: "Suppress info logs",
    type: "boolean",
    default: false,
  })
  .option("dry-run", {
    describe: "Preview actions without writing file",
    type: "boolean",
    default: false,
  })
  .option("no-tree", {
    describe: "Skip directory tree section",
    type: "boolean",
    default: false,
  })
  .help("h")
  .alias("h", "help")
  .version()
  .alias("v", "version")
  .parse();

const CWD = process.cwd();
const OUTPUT_FILE_PATH = path.resolve(CWD, argv.output);

const userIgnore = argv.ignore
  ? argv.ignore
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
  : [];
const userInclude = argv.include
  ? argv.include
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
  : [];

function log(msg, level = "info") {
  if (argv.quiet && level === "info") return;
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
      ? console.warn
      : console.log;
  fn(msg);
}

function main() {
  log(`Starting lingest in directory: ${CWD}`);
  log(`Output will be saved to: ${OUTPUT_FILE_PATH}`);
  if (userInclude.length > 0) {
    log(`Including files matching: ${userInclude.join(", ")}`);
  }

  // Prevent accidental overwrite
  if (!argv.force && !argv.dryRun && fs.existsSync(OUTPUT_FILE_PATH)) {
    log(
      `Error: output file ${OUTPUT_FILE_PATH} exists. Use --force to overwrite.`,
      "error"
    );
    process.exit(1);
  }

  const ignore = [
    ...DEFAULT_IGNORE_GLOBS_FOR_CONTENT,
    `**/${path.basename(OUTPUT_FILE_PATH)}`,
    ...userIgnore,
  ];

  const options = {
    cwd: CWD,
    outputPath: OUTPUT_FILE_PATH,
    ignoreGlobs: ignore,
    includeGlobs: userInclude,
    noTree: argv.noTree,
    dryRun: argv.dryRun,
  };

  try {
    const result = nativeModule.processDirectory(options);

    if (argv.dryRun) {
      log(`\n[Dry Run] --- Summary ---`);
      if (!argv.noTree && result.tree) {
        log(
          `[Dry Run] Directory Structure Preview:\n================================================\n${result.tree}\n================================================`
        );
      } else if (!argv.noTree) {
        log(
          `[Dry Run] No directory structure to include based on rules, or --no-tree specified.`
        );
      }
      if (result.processed_count > 0) {
        log(
          `\n[Dry Run] Would include content from ${result.processed_count} file(s):`
        );
        result.file_contents.forEach((file) => {
          log(`FILE: ${file.path}`);
        });
      } else {
        log(
          `[Dry Run] No files would be processed for content based on rules.`
        );
      }
      log(`[Dry Run] Output would be saved to: ${OUTPUT_FILE_PATH}`);
      return;
    }

    let outputParts = [];
    if (result.tree && !argv.noTree) {
      outputParts.push(
        `Directory Structure:\n================================================\n${result.tree.trim()}\n================================================`
      );
    }

    if (result.processed_count > 0) {
      const contentSection = result.file_contents
        .map((f) => {
          const header = `================================================\nFILE: ${f.path}\n================================================`;
          return f.error
            ? `${header}\n[Content not included: ${f.error}]`
            : `${header}\n${f.content}`;
        })
        .join("\n\n");
      outputParts.push(
        (outputParts.length ? "\n\n" : "") +
          `File Contents:\n================================================\n${contentSection}\n================================================`
      );
    }

    fs.writeFileSync(
      OUTPUT_FILE_PATH,
      outputParts.join("").trim() || "# No content generated."
    );
    log(
      `Generated ${path.relative(CWD, OUTPUT_FILE_PATH)} with ${
        result.processed_count
      } file(s).`
    );
  } catch (err) {
    log(`Error: ${err.message}`, "error");
    process.exit(1);
  }
}

main();
