#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const micromatch = require("micromatch");

const DEFAULT_OUTPUT_FILENAME = "lingest_output.md";
const DEFAULT_IGNORE_DIRS_FOR_TREE = ["node_modules", ".git"]; // For tree generation (name match)
const DEFAULT_IGNORE_GLOBS_FOR_CONTENT = [
  // For content processing (glob match)
  "**/node_modules/**",
  "**/node_modules",
  "**/.git/**",
  "**/.git",
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
  .option("no-tree", {
    describe: "Do not include the directory tree structure in the output",
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
const OUTPUT_FILE_PATH = path.resolve(CWD, OUTPUT_FILENAME);

const userIgnoreGlobs = argv.ignore
  ? argv.ignore
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p)
  : [];
const userIncludeGlobs = argv.include
  ? argv.include
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p)
  : [];

function log(message, level = "info") {
  if (argv.quiet && level === "info") return;
  if (level === "warn") console.warn(message);
  else if (level === "error") console.error(message);
  else console.log(message);
}

/**
 * Generates a string representation of the directory tree.
 * @param {string} dirPath Current directory path to scan.
 * @param {string} basePath The root path of the scan, for relative path calculation.
 * @param {string} currentPrefix Prefix for the current line in the tree (e.g., "│   ").
 * @param {string[]} defaultIgnoreDirs Names of directories to ignore by default.
 * @param {string[]} userIgnoreGlobs User-provided glob patterns for ignoring.
 * @param {string[]} userIncludeGlobs User-provided glob patterns for including.
 * @param {string} absOutputPath Absolute path of the output file to ignore.
 * @returns {string} The formatted tree string.
 */
function generateTreeString(
  dirPath,
  basePath,
  currentPrefix,
  defaultIgnoreDirs,
  userIgnoreGlobs,
  userIncludeGlobs,
  absOutputPath
) {
  let tree = "";
  let entries;
  try {
    entries = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => {
        const fullEntryPath = path.resolve(dirPath, entry.name);
        return fullEntryPath !== absOutputPath; // Always ignore the output file itself
      })
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });
  } catch (e) {
    log(`[Tree] Cannot read directory ${dirPath}: ${e.message}`, "warn");
    return "";
  }

  entries.forEach((entry, index) => {
    const fullEntryPath = path.join(dirPath, entry.name);
    const relativeEntryPathForGlob = path
      .relative(basePath, fullEntryPath)
      .replace(/\\/g, "/");
    const isLastInCurrentDir = index === entries.length - 1;

    if (entry.isDirectory() && defaultIgnoreDirs.includes(entry.name)) {
      log(`[Tree] Ignoring default dir: ${relativeEntryPathForGlob}`, "info");
      return;
    }

    if (micromatch.isMatch(relativeEntryPathForGlob, userIgnoreGlobs)) {
      log(`[Tree] Ignoring user glob: ${relativeEntryPathForGlob}`, "info");
      return;
    }

    const connector = isLastInCurrentDir ? "└── " : "├── ";
    const entryDisplayName = entry.isDirectory()
      ? `${entry.name}/`
      : entry.name;

    if (entry.isDirectory()) {
      tree += `${currentPrefix}${connector}${entryDisplayName}\n`;
      const nextPrefix = currentPrefix + (isLastInCurrentDir ? "    " : "│   ");
      tree += generateTreeString(
        fullEntryPath,
        basePath,
        nextPrefix,
        defaultIgnoreDirs,
        userIgnoreGlobs,
        userIncludeGlobs,
        absOutputPath
      );
    } else if (entry.isFile()) {
      if (
        userIncludeGlobs.length > 0 &&
        !micromatch.isMatch(relativeEntryPathForGlob, userIncludeGlobs)
      ) {
        log(
          `[Tree] Skipping file (not in include): ${relativeEntryPathForGlob}`,
          "info"
        );
        return;
      }
      tree += `${currentPrefix}${connector}${entryDisplayName}\n`;
    }
  });
  return tree;
}

function lingest() {
  log(`Starting lingest in directory: ${CWD}`);
  log(`Output will be saved to: ${OUTPUT_FILE_PATH}`);
  if (userIncludeGlobs.length > 0) {
    log(`Including files matching: ${userIncludeGlobs.join(", ")}`);
  }
  const effectiveIgnoreGlobsForContent = [
    ...DEFAULT_IGNORE_GLOBS_FOR_CONTENT,
    `**/${path.basename(OUTPUT_FILE_PATH)}`, // Glob pattern for output file
    ...userIgnoreGlobs,
  ];
  log(
    `Effective ignore globs for content: ${effectiveIgnoreGlobsForContent.join(
      ", "
    )}`
  );

  if (!argv.force && !argv.dryRun && fs.existsSync(OUTPUT_FILE_PATH)) {
    log(
      `Error: Output file "${OUTPUT_FILE_PATH}" already exists. Use -f or --force to overwrite.`,
      "error"
    );
    process.exit(1);
  }

  // --- Generate Tree Structure ---
  let formattedTree = "";
  if (!argv.noTree) {
    log("Generating directory tree structure...", "info");
    // For tree generation, userIgnoreGlobs are used directly.
    // defaultIgnoreDirs are simple names for directory name matching.
    formattedTree = generateTreeString(
      CWD,
      CWD,
      "",
      DEFAULT_IGNORE_DIRS_FOR_TREE,
      userIgnoreGlobs,
      userIncludeGlobs,
      OUTPUT_FILE_PATH
    ).trimEnd();
  }

  // --- Process File Contents ---
  let allFileContents = [];
  let processedFilesCount = 0;

  function processPathForContent(currentPath) {
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
      const relativePathForGlob = path
        .relative(CWD, fullPath)
        .replace(/\\/g, "/");

      if (path.resolve(fullPath) === OUTPUT_FILE_PATH) continue;

      if (
        micromatch.isMatch(relativePathForGlob, effectiveIgnoreGlobsForContent)
      ) {
        log(
          `[Content] Ignoring (due to ignore pattern): ${relativePathForGlob}`,
          "info"
        );
        continue;
      }

      if (entry.isDirectory()) {
        processPathForContent(fullPath);
      } else if (entry.isFile()) {
        if (
          userIncludeGlobs.length > 0 &&
          !micromatch.isMatch(relativePathForGlob, userIncludeGlobs)
        ) {
          log(
            `[Content] Skipping (not in include patterns): ${relativePathForGlob}`,
            "info"
          );
          continue;
        }

        const relativePathForHeader = path
          .relative(CWD, fullPath)
          .replace(/\\/g, "/");
        const header = `================================================\nFILE: ${relativePathForHeader}\n================================================\n`;

        if (argv.dryRun) {
          log(
            `[Dry Run] Would process file for content: ${relativePathForHeader}`
          );
          allFileContents.push(
            header +
              `[Dry Run] Content of ${relativePathForHeader} would be here.\n`
          );
          processedFilesCount++;
          continue;
        }

        try {
          const fileContentStr = fs.readFileSync(fullPath, "utf-8");
          allFileContents.push(header + fileContentStr);
          log(`[Content] Processed file: ${relativePathForHeader}`);
          processedFilesCount++;
        } catch (error) {
          log(
            `[Content] Skipping file ${relativePathForHeader}. Could not read as UTF-8 text.`,
            "warn"
          );
          allFileContents.push(
            header +
              `[Content not included: Could not be read as UTF-8 text. Might be binary or encoding issue.]\n`
          );
        }
      }
    }
  }

  log("Processing file contents...", "info");
  processPathForContent(CWD);

  // --- Handle Dry Run Output ---
  if (argv.dryRun) {
    log(`\n[Dry Run] --- Summary ---`);
    if (!argv.noTree && formattedTree) {
      log(
        `[Dry Run] Directory Structure Preview:\n================================================\n${formattedTree}\n================================================`
      );
    } else if (!argv.noTree) {
      log(
        `[Dry Run] No directory structure to include based on rules, or --no-tree specified.`
      );
    }
    if (processedFilesCount > 0) {
      log(
        `\n[Dry Run] Would include content from ${processedFilesCount} file(s):`
      );
      allFileContents.forEach((entry) => {
        // In dry run, allFileContents has placeholder content
        const lines = entry.split("\n");
        log(lines[1]); // Log the "FILE: ..." line
      });
    } else {
      log(`[Dry Run] No files would be processed for content based on rules.`);
    }
    log(`[Dry Run] Output would be saved to: ${OUTPUT_FILE_PATH}`);
    return;
  }

  // --- Prepare Final Output ---
  let outputParts = [];
  if (!argv.noTree && formattedTree) {
    outputParts.push(
      "Directory Structure:\n================================================\n" +
        formattedTree +
        "\n================================================"
    );
  }

  if (processedFilesCount > 0) {
    const contentHeader =
      (outputParts.length > 0 ? "\n\n" : "") +
      "File Contents:\n================================================\n";
    outputParts.push(
      contentHeader +
        allFileContents.join("\n\n") +
        "\n================================================"
    );
  }

  if (outputParts.length === 0) {
    log("No content (tree or files) to write based on current rules.", "info");
    try {
      fs.writeFileSync(
        OUTPUT_FILE_PATH,
        "# No content (tree or files) to display based on current rules."
      );
      log(`Generated empty ${OUTPUT_FILENAME}.`);
    } catch (error) {
      log(
        `Failed to write empty output file ${OUTPUT_FILE_PATH}: ${error.message}`,
        "error"
      );
    }
    return;
  }

  const finalMarkdownOutput = outputParts.join("").trim();
  try {
    fs.writeFileSync(
      OUTPUT_FILE_PATH,
      finalMarkdownOutput || "# No content generated."
    );
    let successMessage = `Successfully generated ${OUTPUT_FILENAME}.`;
    if (!argv.noTree && formattedTree)
      successMessage += " Included directory structure.";
    if (processedFilesCount > 0)
      successMessage += ` Included content from ${processedFilesCount} file(s).`;
    log(successMessage);
  } catch (error) {
    log(
      `Failed to write output file ${OUTPUT_FILE_PATH}: ${error.message}`,
      "error"
    );
  }
}

lingest();
