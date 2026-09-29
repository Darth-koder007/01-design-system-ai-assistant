import { Button } from "@ds/components";

export function AlertBanner({
  onDismiss,
  onReport,
}: {
  onDismiss: () => void;
  onReport: () => void;
}) {
  return (
    <div role="alert">
      <p>Something went wrong.</p>
      <Button tone="danger" onClick={onReport}>
        Report issue
      </Button>
      <Button color="neutral" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
