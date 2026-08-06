export function AuthSubmitButton({
  label,
  loading,
}: {
  label: string;
  loading: boolean;
}) {
  return (
    <button
      className="login-submit"
      type="submit"
      disabled={loading}
      aria-busy={loading}
      aria-label={loading ? `${label} — bezig` : label}
    >
      <span className="login-submit__label">{loading ? "Bezig…" : label}</span>
      {loading ? (
        <span className="login-submit__spinner" aria-hidden="true" />
      ) : (
        <svg
          className="login-submit__arrow"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
        </svg>
      )}
    </button>
  );
}

export default AuthSubmitButton;
