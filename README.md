# lingest

`lingest` (Local Ingest) is a command-line tool that generates a single Markdown file named `lingest_output.md`. It recursively finds all text files in the current directory and its subdirectories and concatenates their content. Each file's content is preceded by a header indicating its relative path.

This is particularly useful for creating a single context file for Large Language Models (LLMs) from your local projects, enabling them to understand the structure and content of your codebase or documentation.

## Features

- **Recursive Scanning:** Traverses directories deep to find all relevant files.
- **Content Concatenation:** Combines the content of all found text files into one output.
- **Clear File Headers:** Each file's content is demarcated with `FILE: path/to/file.ext` for easy identification.
- **Customizable Output:** Specify the name of the generated Markdown file.
- **Flexible Filtering:**

  - **Ignore Patterns:** Use glob patterns to exclude specific files or directories (e.g., build artifacts, temporary files).
  - **Include Patterns:** Focus the tool on specific file types or directories using glob patterns.

- **Overwrite Protection:** Prevents accidental overwriting of existing output files unless explicitly forced.
- **Quiet Mode:** Suppresses informational logs, ideal for scripting or CI/CD pipelines.
- **Dry Run Mode:** Preview which files would be included and where the output would be saved, without writing anything.
- **Standard CLI Interface:** Includes `--help` and `--version` flags.

## Installation

The easiest way to use `lingest` is with `npx`:

```bash
npx lingest [options]
```

Alternatively, install it globally using npm, Yarn, or pnpm:

```bash
npm install -g lingest

# or

yarn global add lingest

# or

pnpm add -g lingest
```

Once installed globally, run it directly:

```bash
lingest [options]
```

## Usage

Navigate to the root directory of the project you want to process, then run:

```bash
lingest [options]
```

### Options

| Option      | Alias | Description                                                                                                                                            | Default             |
| ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| `--output`  | `-o`  | Output file name for the generated Markdown.                                                                                                           | `lingest_output.md` |
| `--ignore`  | `-i`  | Comma-separated list of glob patterns to ignore (files or directories). These are added to default ignores.                                            | `""`                |
| `--include` | `-n`  | Comma-separated list of glob patterns to include. If specified, only files matching these patterns will be processed (still respects ignore patterns). | `""` (include all)  |
| `--force`   | `-f`  | Force overwrite of the output file if it already exists.                                                                                               | `false`             |
| `--quiet`   | `-q`  | Suppress informational messages; only errors will be shown.                                                                                            | `false`             |
| `--dry-run` |       | List files that would be processed and the final output path, but don't actually write the file.                                                       | `false`             |
| `--help`    | `-h`  | Show this help message and exit.                                                                                                                       |                     |
| `--version` | `-v`  | Show the program's version number and exit.                                                                                                            |                     |

### Default Ignored Items

By default, `lingest` ignores:

- `node_modules/**`
- `.git/**`
- The output file itself (e.g., `lingest_output.md`, or whatever is specified by `--output`)

### Glob Patterns

`lingest` uses [micromatch](https://github.com/micromatch/micromatch) for glob pattern matching. Common examples:

- `**/*.js`: Matches all `.js` files in any directory.
- `src/**`: Matches all files and folders within the `src` directory.
- `*.log`: Matches all `.log` files in the current directory.
- `!src/important.js`: (Negation not supported directly but illustrates how to exclude files conceptually.)

### Examples

1. **Basic usage (generates `lingest_output.md` in the current directory):**

   ```bash
   lingest
   ```

   Or using npx:

   ```bash
   npx lingest
   ```

2. **Specify a custom output file name:**

   ```bash
   lingest --output project_snapshot.md
   ```

   Or:

   ```bash
   lingest -o project_snapshot.md
   ```

3. **Add custom ignore patterns (e.g., all `dist` folders and `.log` files):**

   ```bash
   lingest --ignore "**/dist/**,**/*.log"
   ```

4. **Only include JavaScript and TypeScript files:**

   ```bash
   lingest --include "**/*.js,**/*.ts"
   ```

5. **Include only `.md` files from the `docs` folder, excluding `drafts`:**

   ```bash
   lingest --include "docs/**/*.md" --ignore "docs/drafts/**"
   ```

6. **Force overwrite an existing output file:**

   ```bash
   lingest --force
   ```

   Or:

   ```bash
   lingest -f
   ```

7. **Dry run for Python files:**

   ```bash
   lingest --dry-run --include "**/*.py"
   ```

8. **Quiet mode for scripting:**

   ```bash
   lingest -q -o context.md
   ```

## Output Format

Each file’s content in the generated Markdown file will be structured like this:

```markdown
# FILE: path/to/your/file.ext

(Content of file.ext)

================================================

# FILE: another/path/file.js

================================================

(Content of file.js)
```

## Handling Non-Text Files

If `lingest` encounters a non-UTF-8 or unreadable file, it will:

1. Log a warning (unless in quiet mode).
2. Include the file’s header.
3. Add `[Content not included: Could not be read as UTF-8 text...]`.

This preserves file structure and alerts you about skipped files.

## Contributing

Contributions are welcome!

1. Fork the repository.
2. Create a branch.
3. Make your changes.
4. Submit a pull request with details.

Issues and suggestions? Open one on [GitHub](https://github.com/chiragasarpota/lingest) (replace with actual link).

## License

MIT License. See `LICENSE` file for details.
