// Simple postinstall check - no building
try {
  require("..");
  console.log("[lingest] Native module loaded successfully");
} catch (e) {
  console.warn(
    "[lingest] Native module not found. This package may not support your platform yet."
  );
  console.warn(
    "[lingest] Supported platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64"
  );
}
