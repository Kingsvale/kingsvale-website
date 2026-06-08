export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);
}

export function projectKey(value: string) {
  const letters = value
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (letters || value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase() || "PRJ").slice(0, 8);
}

export function initials(nameOrEmail: string) {
  const clean = nameOrEmail.trim();
  if (!clean) return "??";
  const nameParts = clean.includes("@") ? clean.split("@")[0].split(/[._-]/) : clean.split(/\s+/);
  return nameParts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
