export function StatusIcon({ ok }: { ok: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16}>
      <circle cx="12" cy="12" r="10" fill={ok ? "#2fa562" : "#dd4b3a"} />
    </svg>
  );
}
