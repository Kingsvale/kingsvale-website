import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function releaseManifest(compose, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision ?? "")) throw new Error("A full Git commit SHA is required for the image tag.");
  const image = /^([ \t]*image:[ \t]*)ghcr\.io\/kingsvale\/kingsvale-website:latest[ \t]*$/gm;
  if ([...compose.matchAll(image)].length !== 1) throw new Error("Expected exactly one Kingsvale image in the source compose file.");
  return compose.replace(image, `$1ghcr.io/kingsvale/kingsvale-website:${revision}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [destination, revision] = process.argv.slice(2);
  if (!destination) throw new Error("A deployment manifest destination is required.");
  const compose = await readFile(new URL("../docker-compose.portainer.yml", import.meta.url), "utf8");
  await writeFile(destination, releaseManifest(compose, revision));
}
