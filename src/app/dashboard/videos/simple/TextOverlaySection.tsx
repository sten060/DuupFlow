"use client";

// Blocs « Captions » et « Sous-titres » (BETA) de la duplication Simple.
//
// Deux panneaux CONTRÔLÉS par le formulaire (il tient le réglage complet, pour
// pouvoir l'enregistrer dans « Mes réglages ») :
//   · CaptionsPanel  — un texte fixe, sa durée, sa police, son fond, ses
//     couleurs, sa position ;
//   · SubtitlesPanel — la voix transcrite, dans un style viral (karaoké, mot
//     par mot, bandeau TikTok, classique), police, couleurs, position.
// Chacun a son « Varier sur chaque copie » : ses réglages passent en choix
// multiple et chaque copie pioche une combinaison différente — les mêmes que
// le serveur (captionVariant / subtitleVariant, src/lib/text-overlay-config.ts).
// L'aperçu (TextPreview) montre la copie choisie, les deux couches ensemble.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/context";
import {
  TEXT_FONTS, TEXT_FONT_KEYS, TEXT_BGS, TEXT_POSITIONS, TEXT_COLORS, SUBTITLE_STYLES, POSITION_Y,
  MAX_CAPTION_CHARS, CAPTION_RANGE_DEFAULT, captionVariant, subtitleVariant, captionVariantCount, subtitleVariantCount,
  captionCenter, subtitleCenter, isLight, usesAccent, CAPTION_SIZE,
  type TextOverlayConfig, type CaptionConfig, type SubtitleConfig, type CaptionVariant, type SubtitleVariant,
  type TextBg, type SubtitleStyle,
} from "@/lib/text-overlay-config";

/** Les polices du moteur, chargées pour que l'aperçu ait la vraie typo. */
const FONT_FACES = `
@font-face{font-family:"Inter";src:url("/fonts/Inter-VariableFont_opsz,wght.ttf") format("truetype");font-weight:100 900;font-display:swap}
@font-face{font-family:"Montserrat";src:url("/fonts/Montserrat-SemiBold.ttf") format("truetype");font-weight:600;font-display:swap}
@font-face{font-family:"Poppins";src:url("/fonts/Poppins-SemiBold.ttf") format("truetype");font-weight:600;font-display:swap}
@font-face{font-family:"Fredoka";src:url("/fonts/Fredoka-SemiBold.ttf") format("truetype");font-weight:600;font-display:swap}
@font-face{font-family:"Archivo Black";src:url("/fonts/ArchivoBlack-Regular.ttf") format("truetype");font-weight:400;font-display:swap}`;

/** Largeur de l'aperçu (px) — mêmes proportions que le rendu (largeur 1080). */
const PREVIEW_W = 240;
const K = PREVIEW_W / 1080;

/** Réglages VIDÉO PAR VIDÉO (tenus par le formulaire) : la vidéo affichée
 *  dans l'aperçu, celles déjà validées (avec leurs réglages) et les actions. */
export type PerVideoCtl = {
  videos: File[];
  index: number;
  setIndex: (i: number) => void;
  /** Aligné sur `videos` : ses réglages si la vidéo est validée, sinon null. */
  validated: (TextOverlayConfig | null)[];
  /** Valide la vidéo affichée (tels quels, sans caption ou sans sous-titres)
   *  puis passe à la suivante non validée. */
  validate: (kind: "current" | "noCaption" | "noSubtitles") => void;
  /** Remet une vidéo validée dans l'aperçu avec ses réglages. */
  load: (i: number) => void;
  unvalidate: (i: number) => void;
  /** Oublie les validations : mêmes réglages pour toutes les vidéos. */
  sameForAll: () => void;
  /** Durée (s) de la vidéo affichée dans l'aperçu, connue une fois chargée. */
  duration: number | null;
  setDuration: (d: number | null) => void;
};

type Props = {
  value: TextOverlayConfig;
  onChange: (v: TextOverlayConfig) => void;
  files: File[];
  /** Copie affichée dans l'aperçu (partagée entre les deux panneaux). */
  copy: number;
  onCopy: (n: number) => void;
  pv: PerVideoCtl;
};

/** Choix d'une option : unique sans variation, cumulable avec (jamais vide). */
function toggleIn<T extends string>(cur: T[], v: T, multi: boolean): T[] {
  if (!multi) return [v];
  const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
  return next.length ? next : cur;
}
/** Sortie du mode variation : on ne garde que le premier choix de chaque liste. */
function firstOnly<T extends Record<string, unknown>>(o: T): T {
  const out = { ...o };
  for (const k of Object.keys(out)) if (Array.isArray(out[k])) (out as Record<string, unknown>)[k] = (out[k] as unknown[]).slice(0, 1);
  return out;
}

/* ══ CAPTIONS ═════════════════════════════════════════════════════════════ */

export function CaptionsPanel({ value, onChange, files, copy, onCopy, pv }: Props) {
  const { t } = useTranslation();
  const c = value.caption;
  const set = (p: Partial<CaptionConfig>) => onChange({ ...value, caption: { ...c, ...p } });
  const pick = <K extends "fonts" | "bgs" | "textColors" | "bgColors" | "positions">(k: K, v: CaptionConfig[K][number]) =>
    set({ [k]: toggleIn(c[k] as string[], v as string, c.vary) } as Partial<CaptionConfig>);
  const total = useMemo(() => captionVariantCount(c), [c]);
  const onlyNoBg = c.bgs.every((b) => b === "none");

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: FONT_FACES }} />
      <p className="text-[12.5px] leading-relaxed text-[var(--app-text-muted)]">{t("textOverlay.captionIntro")}</p>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-3">
        <Switch checked={c.enabled} onChange={(v) => set({ enabled: v })} />
        <span className="text-sm font-semibold text-[var(--app-text)]">{t("textOverlay.captionEnable")}</span>
      </label>

      {c.enabled && (
        <Layout preview={<PreviewColumn value={value} onChange={onChange} files={files} copy={copy} onCopy={onCopy} pv={pv} skip="noCaption" />}>
          <Group title={t("textOverlay.captionTextTitle")}>
            <div className="flex items-baseline justify-end">
              <span className="text-[11px] tabular-nums text-[var(--app-text-faint)]">{c.text.length}/{MAX_CAPTION_CHARS}</span>
            </div>
            <textarea rows={2} maxLength={MAX_CAPTION_CHARS} value={c.text} onChange={(e) => set({ text: e.target.value })}
              placeholder={t("textOverlay.captionPlaceholder")} aria-label={t("textOverlay.captionTextTitle")}
              className="mt-1 w-full resize-none rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] placeholder-[var(--app-text-faint)] outline-none focus:border-indigo-400/70" />
            {!c.text.trim() && <p className="mt-1 text-[12px] font-medium text-amber-300">{t("textOverlay.needText")}</p>}
            <div className="mt-3">
              <p className="text-[12px] font-medium text-[var(--app-text-muted)]">{t("textOverlay.durationTitle")}</p>
              <div className="mt-1.5 inline-flex rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-0.5">
                {(["all", "range"] as const).map((d) => (
                  <button key={d} type="button" onClick={() => set({ duration: d })} aria-pressed={c.duration === d}
                    className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition ${c.duration === d ? "bg-indigo-500 text-white shadow-sm" : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}`}>
                    {t(d === "all" ? "textOverlay.durationAll" : "textOverlay.durationCustom")}
                  </button>
                ))}
              </div>
              {c.duration === "range" && <CaptionWindow c={c} set={set} duration={pv.duration} />}
            </div>
          </Group>

          <VaryCard on={c.vary} total={total} onChange={(v) => onChange({ ...value, caption: v ? { ...c, vary: true } : { ...firstOnly(c), vary: false } })} />

          <Group title={t("textOverlay.styleTitle")} hint={c.vary ? t("textOverlay.varyMulti") : undefined}>
            <div className="space-y-4">
              <Row label={t("textOverlay.font")}><FontChips selected={c.fonts} onPick={(f) => pick("fonts", f)} /></Row>
              <Row label={t("textOverlay.bg")}>
                {TEXT_BGS.map((b) => (
                  <Chip key={b} on={c.bgs.includes(b)} onClick={() => pick("bgs", b)}><BgIcon bg={b} /> {t(`textOverlay.bg_${b}`)}</Chip>
                ))}
              </Row>
              <Row label={t("textOverlay.textColor")}><Swatches selected={c.textColors} onPick={(x) => pick("textColors", x)} /></Row>
              {!onlyNoBg && <Row label={t("textOverlay.bgColor")}><Swatches selected={c.bgColors} onPick={(x) => pick("bgColors", x)} /></Row>}
              {/* Position et taille : à la souris dans l'aperçu (plus de boutons). */}
              {c.size !== CAPTION_SIZE.default && (
                <button type="button" onClick={() => set({ size: CAPTION_SIZE.default })} className="text-[12px] font-semibold text-indigo-400 hover:underline">
                  {t("textOverlay.sizeReset")}
                </button>
              )}
            </div>
          </Group>
          <ValidatedVideos pv={pv} />
        </Layout>
      )}
    </div>
  );
}

/* ══ SOUS-TITRES ══════════════════════════════════════════════════════════ */

export function SubtitlesPanel({ value, onChange, files, copy, onCopy, pv }: Props) {
  const { t } = useTranslation();
  const s = value.subtitles;
  const set = (p: Partial<SubtitleConfig>) => onChange({ ...value, subtitles: { ...s, ...p } });
  const pick = <K extends "styles" | "fonts" | "textColors" | "accentColors" | "positions">(k: K, v: SubtitleConfig[K][number]) =>
    set({ [k]: toggleIn(s[k] as string[], v as string, s.vary) } as Partial<SubtitleConfig>);
  const total = useMemo(() => subtitleVariantCount(s), [s]);
  const needsAccent = s.styles.some(usesAccent);

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: FONT_FACES }} />
      <p className="text-[12.5px] leading-relaxed text-[var(--app-text-muted)]">{t("textOverlay.subtitlesIntro")}</p>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-3">
        <Switch checked={s.enabled} onChange={(v) => set({ enabled: v })} />
        <span className="text-sm font-semibold text-[var(--app-text)]">{t("textOverlay.subtitlesEnable")}</span>
      </label>

      {s.enabled && (
        <Layout preview={<PreviewColumn value={value} onChange={onChange} files={files} copy={copy} onCopy={onCopy} pv={pv} skip="noSubtitles" />}>
          <Group title={t("textOverlay.subStyleTitle")} hint={s.vary ? t("textOverlay.varyMulti") : undefined}>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUBTITLE_STYLES.map((st) => (
                <button key={st} type="button" onClick={() => pick("styles", st)} aria-pressed={s.styles.includes(st)}
                  className={`duup-glass rounded-xl px-3.5 py-3 text-left ${s.styles.includes(st) ? "duup-choix--on" : ""}`}>
                  <span className="flex items-center gap-2">
                    <StyleSample style={st} />
                    <span className="text-[13px] font-semibold text-[var(--app-text)]">{t(`textOverlay.sub_${st}`)}</span>
                    {st === "karaoke" && <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-400">{t("textOverlay.viral")}</span>}
                  </span>
                  <span className="mt-1 block text-[11.5px] leading-snug text-[var(--app-text-muted)]">{t(`textOverlay.sub_${st}_desc`)}</span>
                </button>
              ))}
            </div>
          </Group>

          <p className="rounded-lg bg-[var(--app-surface-2)] px-3 py-2 text-[12px] leading-snug text-[var(--app-text-muted)]">ℹ️ {t("textOverlay.subtitlesNote")}</p>

          <VaryCard on={s.vary} total={total} onChange={(v) => onChange({ ...value, subtitles: v ? { ...s, vary: true } : { ...firstOnly(s), vary: false } })} />

          <Group title={t("textOverlay.styleTitle")} hint={s.vary ? t("textOverlay.varyMulti") : undefined}>
            <div className="space-y-4">
              <Row label={t("textOverlay.font")}><FontChips selected={s.fonts} onPick={(f) => pick("fonts", f)} /></Row>
              <Row label={t("textOverlay.textColor")}><Swatches selected={s.textColors} onPick={(x) => pick("textColors", x)} /></Row>
              {needsAccent && <Row label={t("textOverlay.accentColor")}><Swatches selected={s.accentColors} onPick={(x) => pick("accentColors", x)} /></Row>}
            </div>
          </Group>
          <ValidatedVideos pv={pv} />
        </Layout>
      )}
    </div>
  );
}

/* ══ Aperçu ═══════════════════════════════════════════════════════════════ */

function PreviewColumn({ value, onChange, copy, onCopy, pv, skip }: Props & { skip: "noCaption" | "noSubtitles" }) {
  const { t } = useTranslation();
  const total = Math.max(
    value.caption.enabled ? captionVariantCount(value.caption) : 1,
    value.subtitles.enabled ? subtitleVariantCount(value.subtitles) : 1,
  );
  const cv = captionVariant(value.caption, copy);
  const sv = subtitleVariant(value.subtitles, copy);

  // Plusieurs vidéos : on règle et on VALIDE vidéo par vidéo (ou on garde
  // les mêmes réglages pour toutes) ; la vidéo affichée est tenue par le
  // formulaire (pv), pour que « Valider » passe à la suivante.
  const videos = pv.videos;
  const vi = Math.min(pv.index, Math.max(0, videos.length - 1));
  const current = videos[vi];
  const isValidated = !!pv.validated[vi];
  const allValidated = videos.length > 0 && pv.validated.every(Boolean);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!current) { setUrl(null); return; }
    const u = URL.createObjectURL(current);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [current]);

  // Durée de la caption respectée : « au début seulement » → elle disparaît
  // dans l'aperçu une fois le temps choisi passé (comme sur la copie).
  const [time, setTime] = useState(0);
  const cw = value.caption;
  const captionShown = cw.duration === "all" || !url || (time >= cw.from && (cw.to == null || time < cw.to));

  return (
    <div className="lg:sticky lg:top-4 lg:self-start">
      <p className="text-sm font-semibold text-[var(--app-text)]">{t("textOverlay.previewTitle")}</p>
      {videos.length > 1 && (
        <div className="mt-2" style={{ width: PREVIEW_W }}>
          <div className="flex flex-wrap gap-1">
            {videos.map((f, k) => (
              <button key={`${f.name}-${k}`} type="button" onClick={() => (pv.validated[k] ? pv.load(k) : pv.setIndex(k))} aria-pressed={k === vi} title={f.name}
                className={`min-w-[30px] rounded-md border px-2 py-1 text-[11.5px] font-semibold transition ${k === vi ? "border-indigo-400/70 bg-indigo-500/15 text-[var(--app-text)]" : pv.validated[k] ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-500" : "border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]"}`}>
                {pv.validated[k] ? "✓ " : ""}{k + 1}
              </button>
            ))}
          </div>
          <p className="mt-1 truncate text-[11px] text-[var(--app-text-faint)]">{t("textOverlay.previewVideo", { n: vi + 1, total: videos.length })} · {current?.name}</p>
        </div>
      )}
      <div className="relative mt-2 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-black shadow-lg" style={{ width: PREVIEW_W, aspectRatio: "9 / 16" }}>
        {url ? (
          <video key={url} src={url} muted loop autoPlay playsInline onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => pv.setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-600 via-slate-800 to-slate-900 px-6 text-center text-[12px] leading-snug text-white/70">
            {t("textOverlay.previewEmpty")}
          </div>
        )}
        {value.subtitles.enabled && (
          <Draggable at={subtitleCenter(value.subtitles, sv)} title={t("textOverlay.moveSubtitlesTitle")}
            onMove={(place) => onChange({ ...value, subtitles: { ...value.subtitles, place } })}>
            <SubtitleText v={sv} sample={t("textOverlay.previewSubtitle")} />
          </Draggable>
        )}
        {value.caption.enabled && captionShown && (
          <Draggable at={captionCenter(value.caption, cv, value.subtitles.enabled, sv.position, !!value.subtitles.place)} title={t("textOverlay.moveTitle")}
            onMove={(place) => onChange({ ...value, caption: { ...value.caption, place } })}
            resize={{ size: value.caption.size, title: t("textOverlay.resizeTitle"), onResize: (size) => onChange({ ...value, caption: { ...value.caption, size } }) }}>
            <CaptionText v={cv} size={value.caption.size} text={value.caption.text || t("textOverlay.previewCaptionEmpty")} />
          </Draggable>
        )}
        {value.caption.enabled && cw.duration === "range" && url && (
          <span className="pointer-events-none absolute left-2 top-2 z-30 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {time.toFixed(1)} s{!captionShown ? ` · ${t(time < cw.from ? "textOverlay.captionNotYet" : "textOverlay.captionHidden")}` : ""}
          </span>
        )}
      </div>
      {/* Vidéo par vidéo : valider ces réglages (ou « aucune caption / aucun
          sous-titre ») pour la vidéo affichée, puis passer à la suivante. */}
      {videos.length > 1 && (
        <div className="mt-3 space-y-2" style={{ width: PREVIEW_W }}>
          <button type="button" onClick={() => pv.validate("current")}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white"
            style={{ background: "linear-gradient(180deg,#6366F1,#4F46E5 55%,#4338CA)", boxShadow: "0 8px 20px -10px rgba(79,70,229,0.85), inset 0 1px 0 rgba(255,255,255,0.35)" }}>
            ✓ {isValidated ? t("textOverlay.pvUpdate") : t("textOverlay.pvValidate")}
          </button>
          <button type="button" onClick={() => pv.validate(skip)}
            className="duup-btn w-full rounded-xl px-3 py-2 text-[12.5px] font-semibold text-[var(--app-text)]">
            {t(skip === "noCaption" ? "textOverlay.pvNoCaption" : "textOverlay.pvNoSubtitles")}
          </button>
          <p className="text-[11px] leading-snug text-[var(--app-text-faint)]">
            {allValidated ? t("textOverlay.pvAllDone") : t("textOverlay.pvHint")}
          </p>
          {pv.validated.some(Boolean) && (
            <button type="button" onClick={pv.sameForAll} className="text-[11.5px] font-semibold text-indigo-400 hover:underline">
              {t("textOverlay.pvSameForAll")}
            </button>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] leading-snug text-[var(--app-text-faint)]" style={{ width: PREVIEW_W }}>✋ {t("textOverlay.dragHint")}</p>
      {total > 1 && (
        <div className="mt-2.5 flex items-center justify-between" style={{ width: PREVIEW_W }}>
          <button type="button" onClick={() => onCopy((copy - 1 + total) % total)} aria-label={t("textOverlay.previous")}
            className="duup-btn grid h-8 w-8 place-items-center rounded-lg text-[var(--app-text)]">‹</button>
          <span className="text-[12px] font-semibold text-[var(--app-text-muted)]">{t("textOverlay.previewCopy", { n: copy + 1 })}</span>
          <button type="button" onClick={() => onCopy((copy + 1) % total)} aria-label={t("textOverlay.next")}
            className="duup-btn grid h-8 w-8 place-items-center rounded-lg text-[var(--app-text)]">›</button>
        </div>
      )}
      <p className="mt-2 text-[11px] leading-snug text-[var(--app-text-faint)]" style={{ width: PREVIEW_W }}>{t("textOverlay.previewNote")}</p>
    </div>
  );
}

const anchor = (yPct: number, xPct = 50): React.CSSProperties => ({ position: "absolute", left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)", width: 860 * K, textAlign: "center", pointerEvents: "none" });

/** La caption de l'aperçu, à la taille réglée (px @1080 → px d'aperçu). */
function CaptionText({ v, text, size }: { v: CaptionVariant; text: string; size: number }) {
  const f = TEXT_FONTS[v.font];
  // whiteSpace « pre » : les retours à la ligne TAPÉS sont respectés, et rien
  // d'autre ne coupe la ligne (comme au rendu : une longue phrase déborde).
  const common: React.CSSProperties = { fontFamily: `"${f.family}"`, fontWeight: f.weight, fontSize: size * K, lineHeight: 1.24, color: v.textColor, whiteSpace: "pre" };
  if (v.bg === "none") {
    const o = isLight(v.textColor) ? "#000" : "#fff";
    return <span style={{ ...common, WebkitTextStroke: `${Math.max(0.5, 6 * K)}px ${o}`, paintOrder: "stroke fill", textShadow: `0 ${2 * K}px ${10 * K}px ${o}` }}>{text}</span>;
  }
  if (v.bg === "lines") {
    return <span style={{ ...common, lineHeight: 1.5, background: v.bgColor, padding: `${8 * K}px ${22 * K}px`, borderRadius: 14 * K, WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone" }}>{text}</span>;
  }
  return <span style={{ ...common, display: "inline-block", background: v.bgColor, padding: `${14 * K}px ${22 * K}px`, borderRadius: (v.bg === "square" ? 0 : 26) * K }}>{text}</span>;
}

/** Distance (en % du cadre) sous laquelle la caption « s'aimante » au centre. */
const SNAP_PCT = 2.5;

/** Élément attrapable à la souris dans l'aperçu (même geste que l'éditeur
 *  manuel) : glisser = déplacer (hors cadre permis) ; avec `resize`, la
 *  pastille bas-droite tirée vers l'extérieur agrandit. Près du centre
 *  horizontal ou vertical, il s'y accroche (léger blocage) et un repère
 *  s'affiche ; continuer à tirer le décroche. */
function Draggable({ at, onMove, title, resize, children }: {
  at: { x: number; y: number }; onMove: (p: { x: number; y: number }) => void; title: string;
  resize?: { size: number; title: string; onResize: (size: number) => void };
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [guides, setGuides] = useState({ v: false, h: false });
  const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

  const startMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = ref.current?.parentElement;
    if (!stage) return;
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const o = { x: e.clientX, y: e.clientY, cx: at.x, cy: at.y };
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setActive(true);
    const move = (ev: PointerEvent) => {
      let nx = clamp(o.cx + ((ev.clientX - o.x) / rect.width) * 100, -50, 150);
      let ny = clamp(o.cy + ((ev.clientY - o.y) / rect.height) * 100, -50, 150);
      const snapV = Math.abs(nx - 50) < SNAP_PCT, snapH = Math.abs(ny - 50) < SNAP_PCT;
      if (snapV) nx = 50;
      if (snapH) ny = 50;
      setGuides({ v: snapV, h: snapH });
      onMove({ x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 });
    };
    const up = () => {
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up);
      setActive(false); setGuides({ v: false, h: false });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const startResize = (e: React.PointerEvent<HTMLSpanElement>) => {
    const stage = ref.current?.parentElement;
    if (!stage || !resize) return;
    e.preventDefault();
    e.stopPropagation(); // pas de déplacement en même temps
    const rect = stage.getBoundingClientRect();
    const o = { x: e.clientX, y: e.clientY, size: resize.size };
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setActive(true);
    const move = (ev: PointerEvent) => {
      // Même règle que l'éditeur manuel : vers le bas-droite = plus grand.
      const k = 1 + (ev.clientX - o.x + (ev.clientY - o.y)) / (rect.width * 1.1);
      resize.onResize(Math.round(clamp(o.size * k, CAPTION_SIZE.min, CAPTION_SIZE.max)));
    };
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); setActive(false); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  return (
    <>
      {/* Repères de centrage (visibles seulement quand l'élément est accroché). */}
      {guides.v && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-fuchsia-400" />}
      {guides.h && <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px -translate-y-1/2 bg-fuchsia-400" />}
      <div ref={ref} style={{ ...anchor(at.y, at.x), pointerEvents: "auto", width: "max-content", touchAction: "none" }}
        onPointerDown={startMove} title={title}
        className={`group z-20 cursor-move rounded-md outline-offset-2 ${active ? "outline outline-[1.5px] outline-dashed outline-indigo-400" : "hover:outline hover:outline-[1.5px] hover:outline-dashed hover:outline-white/80"}`}>
        <div style={{ textAlign: "center" }}>{children}</div>
        {resize && (
          <span onPointerDown={startResize} title={resize.title} style={{ touchAction: "none" }}
            className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-indigo-500 opacity-80 shadow transition group-hover:opacity-100" />
        )}
      </div>
    </>
  );
}

/** Sous-titres animés (contenu seul, posé par Draggable) : la phrase
 *  d'exemple défile comme dans la vidéo. */
function SubtitleText({ v, sample }: { v: SubtitleVariant; sample: string }) {
  const words = useMemo(() => sample.split(/\s+/).filter(Boolean), [sample]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setI((n) => (n + 1) % words.length), 420);
    return () => clearInterval(iv);
  }, [words.length]);
  const f = TEXT_FONTS[v.font];
  const o = isLight(v.textColor) ? "#000" : "#fff";
  const base: React.CSSProperties = { fontFamily: `"${f.family}"`, fontWeight: f.weight, color: v.textColor, lineHeight: 1.2, whiteSpace: "nowrap" };

  if (v.style === "word") {
    return <span style={{ ...base, fontSize: 104 * K, textTransform: "uppercase", WebkitTextStroke: `${9 * K * 2}px ${o}`, paintOrder: "stroke fill" }}>{words[i]}</span>;
  }
  if (v.style === "karaoke") {
    const start = Math.floor(i / 3) * 3;
    const chunk = words.slice(start, start + 3);
    return (
      <span style={{ ...base, fontSize: 66 * K, textTransform: "uppercase", WebkitTextStroke: `${7 * K * 2}px ${o}`, paintOrder: "stroke fill" }}>
        {chunk.map((w, k) => <span key={k} style={{ color: start + k === i ? v.accentColor : v.textColor }}>{w}{k < chunk.length - 1 ? " " : ""}</span>)}
      </span>
    );
  }
  const phrase = words.join(" ");
  if (v.style === "native") {
    return <span style={{ ...base, fontSize: 54 * K, lineHeight: 1.5, background: v.accentColor, padding: `${8 * K}px ${22 * K}px`, borderRadius: 14 * K }}>{phrase}</span>;
  }
  return <span style={{ ...base, fontSize: 54 * K, WebkitTextStroke: `${4 * K * 2}px ${o}`, paintOrder: "stroke fill" }}>{phrase}</span>;
}

/* ══ Fenêtre d'affichage de la caption ════════════════════════════════════ */

const fmtS = (n: number) => `${n.toFixed(1).replace(".", ",")} s`;

/** « Personnalisé » : la caption apparaît à `from` et disparaît à `to` (ou
 *  reste jusqu'à la fin). Raccourcis début / milieu / fin, curseurs bornés à
 *  la durée de la vidéo affichée (60 s tant qu'elle n'est pas connue). */
function CaptionWindow({ c, set, duration }: { c: CaptionConfig; set: (p: Partial<CaptionConfig>) => void; duration: number | null }) {
  const { t } = useTranslation();
  const max = Math.max(1, Math.round((duration ?? 60) * 10) / 10);
  const from = Math.min(c.from, Math.max(0, max - 0.1));
  const toEnd = c.to == null;
  const to = toEnd ? max : Math.min(Math.max(c.to!, from + 0.1), max);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const span = Math.min(CAPTION_RANGE_DEFAULT.to - CAPTION_RANGE_DEFAULT.from, max);
  const presets: { key: string; label: string; apply: () => void }[] = [
    { key: "start", label: t("textOverlay.rangeStart"), apply: () => set({ from: 0, to: r1(span) }) },
    { key: "middle", label: t("textOverlay.rangeMiddle"), apply: () => set({ from: r1(Math.max(0, max / 2 - span / 2)), to: r1(Math.min(max, max / 2 + span / 2)) }) },
    { key: "end", label: t("textOverlay.rangeEnd"), apply: () => set({ from: r1(Math.max(0, max - span)), to: null }) },
  ];
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((p) => <Chip key={p.key} on={false} onClick={p.apply}>{p.label}</Chip>)}
        <span className="ml-auto text-[11px] text-[var(--app-text-faint)]">
          {duration ? t("textOverlay.rangeVideoLen", { s: fmtS(duration) }) : t("textOverlay.rangeNoVideo")}
        </span>
      </div>
      {/* Frise : où la caption est visible sur la durée de la vidéo. */}
      <div className="relative h-2 rounded-full bg-[var(--app-surface-2)]">
        <span className="absolute inset-y-0 rounded-full bg-indigo-500" style={{ left: `${(from / max) * 100}%`, width: `${Math.max(1, ((to - from) / max) * 100)}%` }} />
      </div>
      <label className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-[12px] font-medium text-[var(--app-text-muted)]">{t("textOverlay.rangeFrom")}</span>
        <input type="range" min={0} max={max} step={0.1} value={from}
          onChange={(e) => { const f = Number(e.target.value); set({ from: f, to: toEnd ? null : Math.max(c.to ?? max, r1(f + 0.5)) }); }}
          className="w-full accent-indigo-500" />
        <span className="w-14 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--app-text)]">{fmtS(from)}</span>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-24 shrink-0 text-[12px] font-medium text-[var(--app-text-muted)]">{t("textOverlay.rangeTo")}</span>
        <input type="range" min={0} max={max} step={0.1} value={to} disabled={toEnd}
          onChange={(e) => set({ to: Math.max(r1(from + 0.1), Number(e.target.value)) })}
          className="w-full accent-indigo-500 disabled:opacity-40" />
        <span className="w-14 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--app-text)]">{toEnd ? t("textOverlay.rangeEndShort") : fmtS(to)}</span>
      </label>
      <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-[var(--app-text-muted)]">
        <input type="checkbox" checked={toEnd} onChange={(e) => set({ to: e.target.checked ? null : r1(Math.min(max, from + span)) })} className="h-3.5 w-3.5 accent-indigo-500" />
        {t("textOverlay.rangeToEnd")}
      </label>
    </div>
  );
}

/* ══ Vidéos validées (réglages vidéo par vidéo) ══════════════════════════ */

/** Vignette d'une vidéo locale (1re image). */
function LocalThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url
    ? <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="h-14 w-8 shrink-0 rounded-md bg-black object-cover" />
    : <span className="h-14 w-8 shrink-0 rounded-md bg-[var(--app-surface-2)]" />;
}

/** Les vidéos déjà validées, sous les réglages : un clic les remet dans
 *  l'aperçu avec leurs réglages, × annule la validation. */
function ValidatedVideos({ pv }: { pv: PerVideoCtl }) {
  const { t } = useTranslation();
  const items = pv.videos.map((f, i) => ({ f, i, cfg: pv.validated[i] })).filter((x) => x.cfg);
  if (pv.videos.length < 2 || !items.length) return null;
  return (
    <section>
      <div className="flex items-baseline gap-2">
        <h4 className="text-[13px] font-semibold text-[var(--app-text)]">{t("textOverlay.pvValidatedTitle")}</h4>
        <span className="text-[11.5px] text-[var(--app-text-faint)]">{t("textOverlay.pvValidatedCount", { n: items.length, total: pv.videos.length })}</span>
      </div>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {items.map(({ f, i, cfg }) => {
          const c = cfg!;
          const active = i === pv.index;
          const cap = c.caption.enabled && c.caption.text.trim()
            ? `${t("textOverlay.caption")} « ${c.caption.text.trim().replace(/\n/g, " ").slice(0, 32)}${c.caption.text.trim().length > 32 ? "…" : ""} »`
            : t("textOverlay.pvNoCaptionShort");
          const sub = c.subtitles.enabled
            ? `${t("textOverlay.subtitlesTitle")} : ${c.subtitles.styles.map((st) => t(`textOverlay.sub_${st}`)).join(", ")}`
            : t("textOverlay.pvNoSubtitlesShort");
          return (
            <div key={`${f.name}-${i}`}
              className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${active ? "border-indigo-400/70 bg-indigo-500/10 ring-1 ring-indigo-400/30" : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-indigo-400/50"}`}>
              <button type="button" onClick={() => pv.load(i)} title={t("textOverlay.pvLoad")} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <LocalThumb file={f} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-semibold text-[var(--app-text)]">{t("textOverlay.previewVideo", { n: i + 1, total: pv.videos.length })}</span>
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-500">{t("textOverlay.pvBadge")}</span>
                  </span>
                  <span className="block truncate text-[11px] text-[var(--app-text-faint)]">{f.name}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-[var(--app-text-muted)]">{cap}</span>
                  <span className="block truncate text-[11.5px] text-[var(--app-text-muted)]">{sub}</span>
                </span>
              </button>
              <button type="button" onClick={() => pv.unvalidate(i)} title={t("textOverlay.pvUnvalidate")} aria-label={t("textOverlay.pvUnvalidate")}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--app-text-faint)] opacity-0 transition hover:bg-rose-500/10 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ══ Petits éléments ═════════════════════════════════════════════════════ */

function Layout({ children, preview }: { children: React.ReactNode; preview: React.ReactNode }) {
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-6">{children}</div>
      {preview}
    </div>
  );
}

function VaryCard({ on, total, onChange }: { on: boolean; total: number; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${on ? "border-indigo-400/60 bg-indigo-500/[0.07]" : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-indigo-400/40"}`}>
      <Switch checked={on} onChange={onChange} />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-[var(--app-text)]">🎲 {t("textOverlay.varyTitle")}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-[var(--app-text-muted)]">{t("textOverlay.varyDesc")}</span>
        {on && (
          <span className="mt-1.5 inline-block rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold text-indigo-400">
            {total > 1 ? t("textOverlay.combos", { n: total }) : t("textOverlay.combosOne")}
          </span>
        )}
      </span>
    </label>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${checked ? "border-transparent bg-indigo-500" : "border-[var(--app-border-strong)] bg-[var(--app-surface-2)]"}`}>
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-2">
        <h4 className="text-[13px] font-semibold text-[var(--app-text)]">{title}</h4>
        {hint && <span className="text-[11.5px] text-indigo-400">{hint}</span>}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-[var(--app-text-muted)]">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition ${on
        ? "border-indigo-400/70 bg-indigo-500/15 text-[var(--app-text)] ring-1 ring-indigo-400/30"
        : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-indigo-400/40 hover:text-[var(--app-text)]"}`}>
      {children}
    </button>
  );
}

function FontChips({ selected, onPick }: { selected: string[]; onPick: (f: (typeof TEXT_FONT_KEYS)[number]) => void }) {
  return (
    <>
      {TEXT_FONT_KEYS.map((f) => (
        <Chip key={f} on={selected.includes(f)} onClick={() => onPick(f)}>
          <span style={{ fontFamily: `"${TEXT_FONTS[f].family}"`, fontWeight: TEXT_FONTS[f].weight }}>{TEXT_FONTS[f].label}</span>
        </Chip>
      ))}
    </>
  );
}

function Swatches({ selected, onPick }: { selected: string[]; onPick: (c: string) => void }) {
  return (
    <>
      {TEXT_COLORS.map((c) => {
        const on = selected.includes(c);
        return (
          <button key={c} type="button" onClick={() => onPick(c)} aria-pressed={on} aria-label={c} title={c}
            className={`grid h-8 w-8 place-items-center rounded-full border transition ${on ? "border-indigo-400 ring-2 ring-indigo-400/40" : "border-[var(--app-border-strong)] hover:scale-105"}`}
            style={{ background: c }}>
            {on && <span className="text-[13px] font-bold" style={{ color: isLight(c) ? "#111" : "#fff" }}>✓</span>}
          </button>
        );
      })}
    </>
  );
}

function BgIcon({ bg }: { bg: TextBg }) {
  if (bg === "none") return <span className="inline-block w-5 text-center text-[10px] font-bold">Aa</span>;
  if (bg === "lines") return (
    <span className="inline-flex flex-col items-center gap-[1px]" aria-hidden>
      <span className="block h-[5px] w-5 rounded-[2px] bg-current opacity-70" /><span className="block h-[5px] w-3 rounded-[2px] bg-current opacity-70" />
    </span>
  );
  return <span className="inline-block h-3.5 w-5 bg-current opacity-70" style={{ borderRadius: bg === "square" ? 0 : 5 }} aria-hidden />;
}

/** Vignette d'un style de sous-titres (reconnaissable d'un coup d'œil). */
function StyleSample({ style }: { style: SubtitleStyle }) {
  const { locale } = useTranslation();
  const en = locale !== "fr";
  const box = "grid h-7 w-11 shrink-0 place-items-center rounded-md bg-slate-800 text-[8px] font-black leading-none";
  if (style === "karaoke") return <span className={box} style={{ fontFamily: '"Archivo Black"' }}><span><span className="text-white">{en ? "THE " : "LE "}</span><span className="text-yellow-300">{en ? "WORD" : "MOT"}</span></span></span>;
  if (style === "word") return <span className={box} style={{ fontFamily: '"Archivo Black"', fontSize: 11 }}><span className="text-white">{en ? "WORD" : "MOT"}</span></span>;
  if (style === "native") return <span className={box}><span className="rounded-[2px] bg-white px-1 py-[1px] text-[7px] font-semibold text-black">{en ? "Text" : "Texte"}</span></span>;
  return <span className={box}><span className="text-[7.5px] font-semibold text-white">{en ? "Text" : "Texte"}</span></span>;
}
