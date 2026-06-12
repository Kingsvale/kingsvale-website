const requiredKeys = ["STUDIO_PASSWORD", "STUDIO_AUTH_TOKEN_SECRET", "CMS_ENCRYPTION_KEY"];
const missing = requiredKeys.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

await import("./secure-server.mjs");
