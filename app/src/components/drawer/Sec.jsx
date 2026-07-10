export const Sec = ({ t, children }) => (
  <div style={{ marginTop: 10 }}>
    <div style={{ fontWeight: 600, fontSize: 12, color: "var(--tx)", marginBottom: 4 }}>{t}</div>
    {children}
  </div>
);
