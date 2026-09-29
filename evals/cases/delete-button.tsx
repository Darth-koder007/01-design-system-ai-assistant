import { Button } from "@ds/components";

export function DeleteButton({ pending }: { pending: boolean }) {
  return (
    <Button color={pending ? "neutral" : "danger"}>{pending ? "Deleting..." : "Delete"}</Button>
  );
}
