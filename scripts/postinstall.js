const { execSync } = require("child_process");

try {
  // Try to load the native binding exported at package root.
  require("..");
  // If it loads, we have a working binary. Nothing to do.
  process.exit(0);
} catch (e) {
  console.warn(
    "[lingest] Prebuilt binary not found or failed to load, falling back to local build..."
  );
  try {
    execSync("npx --yes --no-install @napi-rs/cli build --platform --release", {
      stdio: "inherit",
    });
  } catch (err) {
    console.error("[lingest] Failed to build native module:", err.message);
    console.error(
      "[lingest] Please ensure Rust toolchain and build essentials are installed, or install a compatible prebuilt binary."
    );
    process.exit(1);
  }
}
