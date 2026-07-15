export function CoachInfoButton({ onInfo }: { onInfo: () => void }) {
  return (
    <button
      type="button"
      className="coach-comment__info"
      onClick={onInfo}
      aria-haspopup="dialog"
      aria-label="Over Coach Rudy"
      title="Over Coach Rudy"
    >
      ⓘ
    </button>
  );
}
