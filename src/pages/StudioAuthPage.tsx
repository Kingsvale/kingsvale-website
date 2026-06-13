import { Lock, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import type { SiteContent } from "../lib/contentTypes";
import { getServerSession, loginServerSession, logoutServerSession } from "../lib/cmsApi";
import { isLocalDemoRuntime, requireServerBackedStudio } from "../lib/runtimeMode";
import {
  clearStudioSession,
  createStudioSession,
  getEncryptedSnapshotSummary,
  hasStudioSession,
  verifyStudioPassphrase
} from "../lib/studioSecurity";
import { AdminPage } from "./AdminPage";

type StudioAuthPageProps = {
  publishedContent: SiteContent;
};

export function StudioAuthPage({ publishedContent }: StudioAuthPageProps) {
  const [authenticated, setAuthenticated] = useState(() => isLocalDemoRuntime() && hasStudioSession());
  const [serverAuthenticated, setServerAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [sessionSecret, setSessionSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkServerSession() {
      const session = await getServerSession();
      if (active && session?.authenticated) {
        setServerAuthenticated(true);
        setAuthenticated(true);
      }
    }

    void checkServerSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const verified = await verifyStudioPassphrase(passphrase);
    if (!verified) {
      setBusy(false);
      setError("Invalid credentials");
      return;
    }

    const serverSession = await loginServerSession(passphrase);
    if (requireServerBackedStudio() && !serverSession?.authenticated) {
      setBusy(false);
      setError("Studio server unavailable");
      return;
    }

    createStudioSession();
    setSessionSecret(passphrase);
    setPassphrase("");
    setAuthenticated(true);
    setServerAuthenticated(Boolean(serverSession?.authenticated));
    setBusy(false);
  }

  if (authenticated) {
    return (
      <AdminPage
        publishedContent={publishedContent}
        studioSecret={sessionSecret}
        encryptedSnapshotSummary={
          serverAuthenticated ? "Server-authenticated editing session." : getEncryptedSnapshotSummary()
        }
        onLogout={async () => {
          if (serverAuthenticated) {
            await logoutServerSession();
          }
          clearStudioSession();
          setAuthenticated(false);
          setServerAuthenticated(false);
          setSessionSecret("");
        }}
      />
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="studio-auth-title">
        <div className="auth-card__icon">
          <Lock aria-hidden="true" />
        </div>
        <p className="eyebrow">Kingsvale studio</p>
        <h1 id="studio-auth-title">Sign in to manage the site.</h1>
        <p>Use your studio passphrase to edit website content, tracking pages, analytics and mailing workflows.</p>
        <form onSubmit={handleSubmit}>
          <label className="admin-field" htmlFor="studio-passphrase">
            <span className="admin-field__label">Studio passphrase</span>
            <input
              id="studio-passphrase"
              type="password"
              value={passphrase}
              autoComplete="current-password"
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>
          {error && <p className="admin-field__error" role="alert">{error}</p>}
          <button type="submit" className="admin-save" disabled={busy}>
            <ShieldCheck aria-hidden="true" />
            {busy ? "Checking credentials" : "Unlock studio"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function AdminDecoyPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="admin-decoy-title">
        <div className="auth-card__icon">
          <ShieldCheck aria-hidden="true" />
        </div>
        <p className="eyebrow">Restricted</p>
        <h1 id="admin-decoy-title">No editor lives here.</h1>
        <p>This public route is intentionally inert. Editing uses the Kingsvale Studio sign-in page.</p>
        <a className="admin-open" href="/">
          Return to homepage
        </a>
      </section>
    </main>
  );
}
