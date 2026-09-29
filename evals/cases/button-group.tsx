import { Button } from "@ds/components";

interface Option {
  id: string;
  label: string;
}

export function ButtonGroup({
  options,
  onSelect,
}: {
  options: Option[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="button-group">
      {options.map((option) => (
        <Button key={option.id} color="neutral" onClick={() => onSelect(option.id)}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}
