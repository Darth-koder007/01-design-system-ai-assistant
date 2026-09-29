export function CardHeader({ title }: { title: string }) {
  return (
    <div style={{ borderBottom: "1px solid #d3d7dc", paddingBottom: "12px", marginBottom: "8px" }}>
      <h3 style={{ color: "#4a5162" }}>{title}</h3>
    </div>
  );
}
