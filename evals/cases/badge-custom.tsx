export function BrandBadge() {
  // Intentionally an off-palette brand color, not a design-token value —
  // should NOT be flagged as a hardcoded-token duplicate.
  return <span style={{ backgroundColor: "#7c3aed", padding: "2px 6px" }}>Partner</span>;
}
