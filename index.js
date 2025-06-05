#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const micromatch = require("micromatch");

const DEFAULT_OUTPUT_FILENAME = "lingest_output.md";
const DEFAULT_IGNORE_DIRS = ["node_modules", ".git"];
const DEFAULT_IGNORE_FILES = []; // Output file will be handled separately

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
    describe:
      "Comma-separated list of glob patterns to ignore (files or directories)",
    type: "string",
    default: "",
  })
  .option("n", {
    alias: "include",
    describe:
      "Comma-separated list of glob patterns to include. If specified, only these will be processed (still respects ignore patterns).",
    type: "string",
    default: "",
  })
  .option("f", {
    alias: "force",
    describe: "Force overwrite of the output file if it already exists",
    type: "boolean",
    default: false,
  })
  .option("q", {
    alias: "quiet",
    describe: "Suppress informational messages, only show errors",
    type: "boolean",
    default: false,
  })
  .option("dry-run", {
    describe: "Show what would be done without writing the file",
    type: "boolean",
    default: false,
  })
  .help("h")
  .alias("h", "help")
  .version()
  .alias("v", "version")
  .epilog("Copyright 2024 Your Name").argv;

const CWD = process.cwd();
const OUTPUT_FILENAME = argv.output;
const OUTPUT_FILE_PATH = path.resolve(CWD, OUTPUT_FILENAME); // Use resolve for absolute path

const userIgnorePatterns = argv.ignore
  ? argv.ignore
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p)
  : [];
const userIncludePatterns = argv.include
  ? argv.include
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p)
  : [];

// Logger function
function log(message, level = "info") {
  if (argv.quiet && level === "info") {
    return;
  }
  if (level === "warn") {
    console.warn(message);
  } else if (level === "error") {
    console.error(message);
  } else {
    console.log(message);
  }
}

function generateMarkdown() {
  log(`Starting lingest in directory: ${CWD}`);
  if (userIncludePatterns.length > 0) {
    log(`Including files matching: ${userIncludePatterns.join(", ")}`);
  }
  const effectiveIgnorePatterns = [
    ...DEFAULT_IGNORE_DIRS.map((dir) => `**/${dir}/**`), // Ignore directory contents
    ...DEFAULT_IGNORE_DIRS.map((dir) => `**/${dir}`), // Ignore directory itself
    ...DEFAULT_IGNORE_FILES.map((file) => `**/${file}`),
    `**/${path.basename(OUTPUT_FILE_PATH)}`, // Always ignore the output file itself using its basename
    ...userIgnorePatterns,
  ];
  log(`Ignoring patterns: ${effectiveIgnorePatterns.join(", ")}`);

  if (!argv.force && !argv.dryRun && fs.existsSync(OUTPUT_FILE_PATH)) {
    log(
      `Error: Output file "${OUTPUT_FILE_PATH}" already exists. Use -f or --force to overwrite.`,
      "error"
    );
    process.exit(1);
  }

  let allFileContents = [];
  let processedFilesCount = 0;

  function processPath(currentPath) {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      log(
        `Could not read directory ${currentPath}: ${error.message}. Skipping.`,
        "warn"
      );
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      // Get relative path for matching, always use forward slashes for micromatch
      const relativePathForMatch = path
        .relative(CWD, fullPath)
        .replace(/\\/g, "/");

      // Skip the output file itself explicitly by absolute path comparison
      if (path.resolve(fullPath) === OUTPUT_FILE_PATH) {
        continue;
      }

      // Check against ignore patterns
      if (micromatch.isMatch(relativePathForMatch, effectiveIgnorePatterns)) {
        log(
          `Ignoring (due to ignore pattern): ${relativePathForMatch}`,
          "info"
        );
        continue;
      }

      if (entry.isDirectory()) {
        processPath(fullPath);
      } else if (entry.isFile()) {
        // If include patterns are specified, the file must match at least one
        if (
          userIncludePatterns.length > 0 &&
          !micromatch.isMatch(relativePathForMatch, userIncludePatterns)
        ) {
          log(
            `Skipping (not in include patterns): ${relativePathForMatch}`,
            "info"
          );
          continue;
        }

        const relativePathForHeader = path
          .relative(CWD, fullPath)
          .replace(/\\/g, "/");
        const header = `================================================\nFILE: ${relativePathForHeader}\n================================================\n`;

        if (argv.dryRun) {
          log(`[Dry Run] Would process file: ${relativePathForHeader}`);
          allFileContents.push(
            header +
              `[Dry Run] Content of ${relativePathForHeader} would be here.\n`
          );
          processedFilesCount++;
          continue;
        }

        let fileContentStr;
        try {
          fileContentStr = fs.readFileSync(fullPath, "utf-8");
          allFileContents.push(header + fileContentStr);
          log(`Processed file: ${relativePathForHeader}`);
          processedFilesCount++;
        } catch (error) {
          log(
            `Skipping file ${relativePathForHeader}. Could not read as UTF-8 text. It might be binary or an encoding issue.`,
            "warn"
          );
          allFileContents.push(
            header +
              `[Content not included: Could not be read as UTF-8 text. It might be a binary file, have an unsupported encoding, or there might be a permission issue.]\n`
          );
        }
      }
    }
  }

  processPath(CWD);

  if (argv.dryRun) {
    log(`\n[Dry Run] Summary:`);
    log(`[Dry Run] Would process ${processedFilesCount} file(s).`);
    log(`[Dry Run] Output would be saved to: ${OUTPUT_FILE_PATH}`);
    // Optionally print the structure if needed for dry run
    // const dryRunStructure = allFileContents.map(entry => entry.split('\n')[1]).join('\n');
    // log(`[Dry Run] File structure:\n${dryRunStructure}`);
    return;
  }

  if (processedFilesCount === 0) {
    log(
      "No files were processed based on current include/ignore rules.",
      "info"
    );
    try {
      fs.writeFileSync(
        OUTPUT_FILE_PATH,
        "# No files found or processed based on current include/ignore rules."
      );
      log(`Generated empty ${OUTPUT_FILENAME} as no content was processed.`);
    } catch (error) {
      log(
        `Failed to write empty output file ${OUTPUT_FILE_PATH}: ${error.message}`,
        "error"
      );
    }
    return;
  }

  const finalMarkdown = allFileContents.join("\n\n");
  try {
    fs.writeFileSync(OUTPUT_FILE_PATH, finalMarkdown);
    log(
      `Successfully generated ${OUTPUT_FILENAME} with content from ${processedFilesCount} file(s).`
    );
  } catch (error) {
    log(
      `Failed to write output file ${OUTPUT_FILE_PATH}: ${error.message}`,
      "error"
    );
  }
}

generateMarkdown();
