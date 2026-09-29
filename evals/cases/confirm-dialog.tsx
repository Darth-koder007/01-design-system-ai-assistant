import { Button, Modal } from "@ds/components";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Are you sure?">
      <p>This will permanently delete the item.</p>
      <Button color="danger" onClick={onConfirm}>
        Delete forever
      </Button>
    </Modal>
  );
}
