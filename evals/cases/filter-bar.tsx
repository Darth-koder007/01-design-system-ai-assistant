export function FilterBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="filter-bar">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter results..."
      />
    </div>
  );
}
