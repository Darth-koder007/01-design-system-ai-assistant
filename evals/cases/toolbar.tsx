import { Button } from "@ds/components";

const commonProps = {
  size: "sm" as const,
};

export function Toolbar() {
  return (
    <div className="toolbar">
      <Button {...commonProps} color="accent">
        New
      </Button>
      <Button {...commonProps} tone="neutral">
        Refresh
      </Button>
    </div>
  );
}
