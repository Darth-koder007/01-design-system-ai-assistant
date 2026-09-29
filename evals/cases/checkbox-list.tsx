interface Item {
  id: string;
  label: string;
  checked: boolean;
}

export function CheckboxList({ items }: { items: Item[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <input type="checkbox" checked={item.checked} readOnly />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
