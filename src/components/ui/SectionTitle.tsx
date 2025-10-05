export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="space-y-1">
      <h1 className="h1">{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </header>
  );
}