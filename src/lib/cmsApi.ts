import type { ImageAsset, SiteContent } from "./contentTypes";

type StudioSession = {
  authenticated: boolean;
  user: { name: string; role: string };
  csrfToken: string;
  expiresAt: string;
};

type RevisionSummary = {
  id: string;
  createdAt: string;
  user: string;
  title: string;
};

let csrfToken = "";

export async function getServerSession() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      csrfToken = "";
      return null;
    }

    const session = (await response.json()) as StudioSession;
    csrfToken = session.csrfToken;
    return session;
  } catch {
    csrfToken = "";
    return null;
  }
}

export async function logoutServerSession() {
  await ensureCsrfToken();
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: csrfHeaders()
  });
  csrfToken = "";
}

export async function fetchCmsDraft() {
  await ensureCsrfToken();
  const response = await fetch("/api/cms/draft", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error("CMS draft could not be loaded.");
  }
  return (await response.json()) as {
    draft: SiteContent | null;
    published: SiteContent | null;
    updatedAt: string | null;
  };
}

export async function saveCmsDraft(content: SiteContent) {
  await ensureCsrfToken();
  const response = await fetch("/api/cms/draft", {
    method: "PUT",
    credentials: "same-origin",
    headers: csrfHeaders(),
    body: JSON.stringify({ content })
  });
  if (!response.ok) {
    throw new Error("CMS draft could not be saved.");
  }
}

export async function publishCmsContent(content: SiteContent) {
  await ensureCsrfToken();
  const response = await fetch("/api/cms/publish", {
    method: "POST",
    credentials: "same-origin",
    headers: csrfHeaders(),
    body: JSON.stringify({ content })
  });
  if (!response.ok) {
    throw new Error("CMS content could not be published.");
  }
}

export async function listCmsRevisions() {
  await ensureCsrfToken();
  const response = await fetch("/api/cms/revisions", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    return [] as RevisionSummary[];
  }
  const payload = (await response.json()) as { revisions: RevisionSummary[] };
  return payload.revisions;
}

export async function restoreCmsRevision(id: string) {
  await ensureCsrfToken();
  const response = await fetch(`/api/cms/revisions/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    credentials: "same-origin",
    headers: csrfHeaders()
  });
  if (!response.ok) {
    throw new Error("Revision could not be restored.");
  }
  return (await response.json()) as { content: SiteContent };
}

export async function uploadCmsImage(file: File): Promise<ImageAsset | null> {
  try {
    await ensureCsrfToken();
    const formData = new FormData();
    formData.set("image", file);
    const response = await fetch("/api/uploads/images", {
      method: "POST",
      credentials: "same-origin",
      headers: { "x-csrf-token": csrfToken },
      body: formData
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { image: ImageAsset };
    return payload.image;
  } catch {
    return null;
  }
}

async function ensureCsrfToken() {
  if (csrfToken) {
    return;
  }
  await getServerSession();
}

function csrfHeaders() {
  return {
    "Content-Type": "application/json",
    "x-csrf-token": csrfToken
  };
}
