interface Action {
  id: string;
  label: string;
  onClick: () => void;
}

export function CardActions({ actions }: { actions: Action[] }) {
  return (
    <div className="card-actions">
      {actions.map((action) => (
        <button key={action.id} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  );
}
