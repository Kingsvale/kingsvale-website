import { Lock, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import type { SiteContent } from "../lib/contentTypes";
import { getServerSession, logoutServerSession } from "../lib/cmsApi";
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
  const [authenticated, setAuthenticated] = useState(() => hasStudioSession());
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
      setError("Access was not granted. Check the studio passphrase.");
      return;
    }

    createStudioSession();
    setSessionSecret(passphrase);
    setPassphrase("");
    setAuthenticated(true);
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
        <p className="eyebrow">Private studio</p>
        <h1 id="studio-auth-title">Authorised editing only.</h1>
        <p>
          The editor sits behind a generated route and passphrase gate. Public
          content remains available without exposing editing controls.
        </p>
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
            {busy ? "Verifying" : "Unlock studio"}
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
        <p>
          This public route is intentionally inert. Editing uses a generated
          private path, session gate and cryptographic verifier.
        </p>
        <a className="admin-open" href="/">
          Return to homepage
        </a>
      </section>
    </main>
  );
}
