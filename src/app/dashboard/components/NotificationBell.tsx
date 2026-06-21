"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/context";
import JSZip from "jszip";
import {
  subscribe as subscribeJobs,
  snapshot as jobsSnapshot,
  removeJob,
  type Job,
} from "../videos/jobStore";
import {
  subscribeNotifications,
  notificationsSnapshot,
  pushNotification,
  dismissNotification,
  clearNotifications,
  markAllNotificationsRead,
  SESSION_START,
  type AppNotification,
} from "./notificationStore";

async function downloadAllAsZip(files: { name: string; url: string }[], label: string) {
  const zip = new JSZip();
  await Promise.all(
    files.map(async (f) => {
      const res = await fetch(f.url);
      zip.file(f.name, await res.blob());
    }),
  );
  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = `DuupFlow_${label}_${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function NotifCard({ n }: { n: AppNotification }) {
  const { t } = useTranslation();
  const [zipping, setZipping] = useState(false);
  const tone =
    n.kind === "success"
      ? "border-emerald-400/25 bg-emerald-500/[0.07]"
      : n.kind === "error"
      ? "border-rose-400/25 bg-rose-500/[0.07]"
      : "border-white/10 bg-white/[0.04]";
  const icon = n.kind === "success" ? "✓" : n.kind === "error" ? "✗" : "•";

  const head = (
    <>
      <p className="text-xs font-semibold text-white/85">
        <span className="mr-1">{icon}</span>
        {n.title}
      </p>
      {n.body && <p className="mt-0.5 text-[11px] leading-snug text-white/55 whitespace-pre-line">{n.body}</p>}
      {n.href && (
        <span className="mt-1.5 inline-block text-[11px] font-semibold text-sky-300 group-hover:text-sky-200">
          {t("dashboard.notif.discover")} →
        </span>
      )}
    </>
  );

  return (
    <div className={`rounded-xl border px-3 py-2 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        {n.href ? (
          <a href={n.href} className="group min-w-0 flex-1 block">
            {head}
          </a>
        ) : (
          <div className="min-w-0 flex-1">{head}</div>
        )}
        <button
          onClick={() => dismissNotification(n.id)}
          className="shrink-0 rounded-full px-1 text-white/30 hover:text-white/80"
          title={t("dashboard.videosCommon.close")}
        >
          ✕
        </button>
      </div>
      {n.files && n.files.length > 0 && (
        <button
          type="button"
          disabled={zipping}
          onClick={async () => {
            setZipping(true);
            try { await downloadAllAsZip(n.files!, "videos"); } finally { setZipping(false); }
          }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold bg-indigo-600/70 hover:bg-indigo-500/80 disabled:opacity-50 disabled:cursor-wait border border-indigo-400/30 text-white transition"
        >
          {zipping ? <><span className="animate-spin">⟳</span>{t("dashboard.videosCommon.preparingZip")}</> : <>↓ {t("dashboard.videosCommon.downloadAll", { count: n.files.length })}</>}
        </button>
      )}
    </div>
  );
}

const DEFAULT_TOAST_MS = 5000;

// A transient toast that pops out near the bell, then hides itself after its
// duration. The underlying notification still lives in the panel if persistent.
function ToastItem({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
  // Notifications restored from a previous session live only in the panel — they
  // must not re-pop as toasts on every reload.
  const isFresh = n.createdAt >= SESSION_START;
  const [visible, setVisible] = useState(isFresh);
  useEffect(() => {
    if (!isFresh) return;
    const t = setTimeout(() => setVisible(false), n.duration ?? DEFAULT_TOAST_MS);
    return () => clearTimeout(t);
  }, [isFresh, n.duration]);
  if (!visible) return null;
  const tone =
    n.kind === "success" ? "border-emerald-300/30 bg-emerald-600/90"
    : n.kind === "error" ? "border-rose-300/30 bg-rose-600/90"
    : "border-indigo-300/30 bg-indigo-600/90";
  const icon = n.kind === "success" ? "✓" : n.kind === "error" ? "✗" : "↪";
  const inner = (
    <>
      <p className="text-xs font-semibold"><span className="mr-1">{icon}</span>{n.title}</p>
      {n.body && <p className="mt-0.5 text-[11px] leading-snug text-white/85">{n.body}</p>}
    </>
  );
  const cls = `pointer-events-auto block w-full text-left rounded-xl border px-3 py-2 text-white shadow-xl backdrop-blur-md transition ${tone}`;
  // href toasts navigate on click (full nav so it can't be cancelled); the rest
  // just open the bell panel.
  return n.href ? (
    <a href={n.href} className={cls}>{inner}</a>
  ) : (
    <button type="button" onClick={onOpen} className={cls}>{inner}</button>
  );
}

export default function NotificationBell() {
  const notifs = useSyncExternalStore(subscribeNotifications, notificationsSnapshot, () => []);
  const jobs = useSyncExternalStore(subscribeJobs, jobsSnapshot, () => []);
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();

  // ── Bridge: turn finished/failed/stopped jobs into bell notifications ───────
  // Live RUNNING progress stays on the page (GlobalVideoProgress); only the
  // terminal transitions become notifications here, then the job is dropped.
  const seenRef = useRef<Map<string, Job["status"]>>(new Map());
  useEffect(() => {
    let needsRefresh = false;
    for (const job of jobs) {
      const prev = seenRef.current.get(job.id);
      if (job.status === prev) continue;
      seenRef.current.set(job.id, job.status);
      if (job.status === "done") {
        const n = job.completedFiles.length;
        // Body is derived from STATUS, never from job.msg — that field can carry
        // a raw French SSE message from the server (evt.warning / evt.msg), which
        // would leak to English users. We show the localized file-count instead,
        // or the generic "done" line when no count is available.
        pushNotification({
          kind: "success",
          title: t("dashboard.videosCommon.doneTitle"),
          body: n > 0 ? t("dashboard.videosCommon.filesReady", { count: n }) : t("dashboard.notif.doneGeneric"),
          files: job.completedFiles.length ? job.completedFiles : undefined,
        });
        removeJob(job.id);
        needsRefresh = true;
      } else if (job.status === "error") {
        // Do NOT surface job.errorMsg / job.msg — those are raw server SSE
        // strings (French). Show a localized, status-derived error body instead.
        pushNotification({ kind: "error", title: t("dashboard.videosCommon.failTitle"), body: t("dashboard.notif.errorBody") });
        removeJob(job.id);
        needsRefresh = true;
      } else if (job.status === "stopped") {
        pushNotification({
          kind: "info",
          title: t("dashboard.videosCommon.stoppedTitle"),
          body: job.completedFiles.length ? t("dashboard.videosCommon.alreadyReadyShort", { count: job.completedFiles.length }) : undefined,
          files: job.completedFiles.length ? job.completedFiles : undefined,
        });
        removeJob(job.id);
        needsRefresh = true;
      }
    }
    const ids = new Set(jobs.map((j) => j.id));
    for (const id of Array.from(seenRef.current.keys())) if (!ids.has(id)) seenRef.current.delete(id);
    // A finished job just renamed its outputs into place — refresh the page's
    // server-rendered "Videos générées" list (esp. after a resume, where the
    // form's own refresh never runs).
    if (needsRefresh) router.refresh();
  }, [jobs, router, t]);

  const anyRunning = jobs.some((j) => j.status === "running");
  const unread = notifs.filter((n) => !n.read).length;

  const toggle = () => {
    setOpen((o) => {
      if (!o) markAllNotificationsRead();
      return !o;
    });
  };

  return (
    <>
      {/* Bell — just above the chat bubble (which sits at bottom-5 right-5) */}
      <button
        onClick={toggle}
        aria-label={t("dashboard.videosCommon.notifTitle")}
        className={`fixed bottom-20 right-5 z-50 h-12 w-12 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/10 text-white flex items-center justify-center shadow-lg hover:bg-white/[0.12] transition-all ${anyRunning ? "ring-2 ring-indigo-400/50 animate-pulse" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Transient toasts popping out of the bell (hidden while the panel is open) */}
      {!open && (
        <div className="fixed bottom-36 right-5 z-50 w-72 flex flex-col-reverse gap-2 pointer-events-none">
          {notifs.map((n) => <ToastItem key={n.id} n={n} onOpen={() => setOpen(true)} />)}
        </div>
      )}

      {open && (
        <div className="fixed bottom-36 right-5 z-50 w-80 max-h-[28rem] rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.1] flex flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white/80">{t("dashboard.videosCommon.notifTitle")}</span>
            <div className="flex items-center gap-2">
              {notifs.length > 0 && (
                <button onClick={clearNotifications} className="text-xs text-white/40 hover:text-white/70 transition">{t("dashboard.videosCommon.clearAll")}</button>
              )}
              <button onClick={() => setOpen(false)} className="rounded-full px-1 text-white/40 hover:text-white/80" title={t("dashboard.videosCommon.close")}>✕</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {notifs.length === 0 && (
              <p className="px-2 py-8 text-center text-xs text-white/40">{t("dashboard.videosCommon.noNotifs")}</p>
            )}
            {notifs.map((n) => <NotifCard key={n.id} n={n} />)}
          </div>
        </div>
      )}
    </>
  );
}
