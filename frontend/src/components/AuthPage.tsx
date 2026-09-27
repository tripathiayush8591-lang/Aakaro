interface Props {
  pending: boolean;
  error: string;
  onLogin: () => void;
  initializing: boolean;
}
export function AuthPage({ pending, error, onLogin, initializing }: Props) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-label="Welcome to Aakaro">
        <div className="auth-art">
          <span className="art-wordmark">aakaro</span>
          <div className="art-copy">
            <h1>
              Give your idea
              <br />
              an identity.
            </h1>
            <p>
              Every idea starts somewhere.
              <br />
              Give yours a little shape.
            </p>
          </div>
          <span className="art-caption">A space for your next beginning.</span>
        </div>
        <div className="auth-content">
          <div className="auth-content-inner">
            <span className="eyebrow">Aakaro</span>
            <h2>
              It starts with <br />
              your idea.
            </h2>
            <p className="muted intro">
              Bring the spark. <br />
              Let’s see what it could become.
            </p>
            <button
              className="google-button"
              onClick={onLogin}
              disabled={pending || initializing}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="20"
                height="20"
              >
                <path
                  fill="#4285F4"
                  d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.4 3-7.6Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.4 3-4.1 5.6-4.1Z"
                />
              </svg>
              {initializing
                ? "Checking your session…"
                : pending
                  ? "Opening Google…"
                  : "Continue with Google"}
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <p className="auth-note">One account. Room for new ideas.</p>
          </div>
        </div>
      </section>
      <p className="page-caption">A little spark. A new shape. Aakaro.</p>
    </main>
  );
}
