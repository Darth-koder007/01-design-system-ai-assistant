import type { ReactNode } from "react";

export function PageBackground({ children }: { children: ReactNode }) {
  return (
    <div style={{ backgroundColor: "#f5f6f7" }}>
      <div style={{ backgroundColor: "#ffffff" }}>{children}</div>
    </div>
  );
}
