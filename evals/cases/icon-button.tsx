import { Button } from "@ds/components";

export function IconButton() {
  return (
    <Button color="danger">
      <svg viewBox="0 0 24 24">
        <path d="M6 6h12v12H6z" fill="#dd4b3a" />
      </svg>
      Remove
    </Button>
  );
}
