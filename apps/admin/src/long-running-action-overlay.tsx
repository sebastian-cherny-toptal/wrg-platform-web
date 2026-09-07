import { useId } from "react";

export function LongRunningActionOverlay({ title }: { title: string }) {
  const titleId = useId();

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="long-running-action-overlay"
      role="dialog"
    >
      <div className="long-running-action-message">
        <span aria-hidden="true" className="long-running-action-spinner" />
        <strong id={titleId}>{title}</strong>
        <p>This can take up to 5 minutes.</p>
      </div>
    </div>
  );
}
