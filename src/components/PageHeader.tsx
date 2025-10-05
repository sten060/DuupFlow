export default function PageHeader({
  title, subtitle, accent = "indigo",
  right,
}: {
  title: string;
  subtitle?: string;
  accent?: "indigo" | "green";
  right?: React.ReactNode;
}) {
  const bar = accent === "green" ? "from-greenA/20" : "from-indigoA/25";
  return (
    <header className="card p-5">
      <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${bar} to-transparent mb-3`} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="text-sm text-white/60 mt-1">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}