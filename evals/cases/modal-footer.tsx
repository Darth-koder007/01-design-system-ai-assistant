import { Button as DsButton } from "@ds/components";

export function ModalFooter({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <footer>
      <DsButton tone="neutral" onClick={onCancel}>
        Cancel
      </DsButton>
      <button onClick={onConfirm}>Confirm</button>
    </footer>
  );
}
