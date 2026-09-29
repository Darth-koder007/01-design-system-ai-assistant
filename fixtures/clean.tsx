import { Button, Input } from "@ds/components";

export function CleanForm() {
  return (
    <form>
      <Input label="Name" />
      <Button tone="accent">Save</Button>
    </form>
  );
}
