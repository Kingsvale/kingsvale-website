import { copyFile } from "node:fs/promises";

await copyFile("dist/index.html", "dist/app.html");
console.log("Created dist/app.html fallback shell.");
