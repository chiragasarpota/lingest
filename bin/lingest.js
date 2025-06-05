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
  console.error(
    "Failed to load native module. Did you run 'npm run build'?\n",
    err.message
  );
  process.exit(1);
}

const DEFAULT_OUTPUT_FILENAME = "lingest_output.md";
const DEFAULT_IGNORE_GLOBS_FOR_CONTENT = [
  // Version control & dependencies
  "**/node_modules/**",
  "**/node_modules",
  "**/.git/**",
  "**/.git",
  "**/vendor/**",
  "**/third_party/**",
  "**/external/**",
  // System files
  "**/.DS_Store",
  "**/thumbs.db",
  "**/desktop.ini",
  // Lock files
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/Cargo.lock",
  "**/Pipfile.lock",
  "**/composer.lock",
  "**/Gemfile.lock",
  "**/poetry.lock",
  // IDE / editor
  "**/.vscode/**",
  "**/.idea/**",
  "**/.vs/**",
  "**/*.swp",
  "**/*.swo",
  "**/*~",
  "**/.project",
  "**/.classpath",
  "**/.settings/**",
  // Cache directories
  "**/.cache/**",
  "**/.parcel-cache/**",
  "**/.webpack/**",
  "**/.rollup/**",
  "**/.eslintcache",
  "**/.stylelintcache",
  "**/.rpt2_cache/**",
  "**/.yarn/**",
  "**/.pnpm/**",
  "**/.rush/**",
  "**/.nyc_output/**",
  // Build & output
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/out/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/public/build/**",
  "**/_site/**",
  "**/site/**",
  "**/docs/_build/**",
  // Temp / backup
  "**/*.tmp",
  "**/*.temp",
  "**/*.bak",
  "**/*.backup",
  "**/*.orig",
  "**/*.rej",
  "**/*.swp",
  // Env files
  "**/.env",
  "**/.env.local",
  "**/.env.*.local",
  "**/.env.production",
  // Generated
  "**/*generated*",
  "**/*gen*",
  "**/*.generated.*",
  // Media
  "**/*.{jpg,jpeg,png,gif,bmp,svg,ico,webp,tiff,psd,raw,heif,indd,ai,eps}",
  "**/*.{mp4,avi,mov,wmv,flv,mkv,webm,vob,ogv,m4v,3gp,3g2,mpeg,mpg}",
  "**/*.{mp3,wav,flac,aac,ogg,wma,m4a,opus,aiff,ape}",
  // Archives
  "**/*.{zip,tar,gz,rar,7z,bz2,xz,iso,dmg,pkg}",
  // Executables
  "**/*.{exe,dll,so,dylib,lib,a,o,app,deb,rpm,msi,pkg}",
  // Docs
  "**/*.{pdf,doc,docx,xls,xlsx,ppt,pptx,odt,ods,odp}",
  // Fonts
  "**/*.{ttf,otf,woff,woff2,eot,fon,fnt}",
  // DBs
  "**/*.{db,sqlite,sqlite3,mdb,accdb}",
  // Compiled
  "**/*.{pyc,pyo,class,jar,war,ear}",
  // Minified
  "**/*.{min.js,min.css}",
  // Data
  "**/*.{csv,tsv}",
  "**/*data*.json",
  "**/*fixture*.json",
  "**/*mock*.json",
  "**/*.xml",
  // Logs
  "**/*.log",
  "**/logs/**",
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
      log(
        "[Dry Run] Summary:\n" +
          JSON.stringify({ processed: result.processed_count }, null, 2)
      );
      if (result.tree && !argv.noTree) log(result.tree);
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
