export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "rgba(99,102,241,0.5)", borderTopColor: "transparent" }}
        />
        <p className="text-xs text-white/25 tracking-wide">Chargement…</p>
      </div>
    </div>
  );
}
