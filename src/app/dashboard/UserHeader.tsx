export default function UserHeader() {
  return (
    <header className="mb-8 flex items-center justify-between">
      {/* Titre principal */}
      <h1 className="text-2xl font-semibold bg-gradient-to-r from-fuchsia-400 via-indigo-400 to-fuchsia-500 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,0,255,0.25)] animate-pulse-slow">
        Dashboard
      </h1>

      {/* Bloc utilisateur local */}
      <div className="relative group">
        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-fuchsia-500 blur-md opacity-70 group-hover:opacity-100 transition duration-700 animate-glow" />
        <div className="relative rounded-xl bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-md border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          Mode{" "}
          <span className="font-medium text-fuchsia-300">Local</span>
        </div>
      </div>
    </header>
  );
}