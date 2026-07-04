"use client";

// Simple, static (non-animated) mockups shown under each module's "What it's for"
// doc topic. Pure SVG in the DuupFlow palette, no text so they stay
// language-neutral. Kept intentionally minimal.

import React from "react";

const IND = "rgba(99,102,241,0.14)";
const INDS = "rgba(99,102,241,0.55)";
const SKY = "rgba(56,189,248,0.14)";
const SKYS = "rgba(56,189,248,0.55)";
const LINE = "rgba(255,255,255,0.30)";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <svg viewBox="0 0 320 120" className="w-full h-auto" aria-hidden="true">{children}</svg>
    </div>
  );
}

function Arrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2 - 7} y2={y} stroke={LINE} strokeWidth="2" strokeLinecap="round" />
      <path d={`M${x2} ${y} l-8 -5 v10 z`} fill={LINE} />
    </g>
  );
}

function Tile({ x, y, w = 46, h = 44, fill = IND, stroke = INDS }: { x: number; y: number; w?: number; h?: number; fill?: string; stroke?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} stroke={stroke} strokeWidth="1.5" />;
}

// Small image glyph (mountain + sun) sized to a ~46×44 tile at (x,y).
function ImgGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g fill="#A5B4FC">
      <circle cx={x + 14} cy={y + 15} r="3.5" />
      <path d={`M${x + 7} ${y + 37} L${x + 19} ${y + 22} L${x + 28} ${y + 31} L${x + 33} ${y + 26} L${x + 40} ${y + 37} Z`} opacity="0.9" />
    </g>
  );
}

/** Images: 1 source → several unique copies. */
export function ImagesMockup() {
  return (
    <Frame>
      <Tile x={24} y={38} />
      <ImgGlyph x={24} y={38} />
      <Arrow x1={82} x2={150} y={60} />
      <Tile x={250} y={30} w={44} h={42} fill={SKY} stroke={SKYS} />
      <Tile x={234} y={42} w={44} h={42} fill={SKY} stroke={SKYS} />
      <Tile x={218} y={54} w={44} h={42} fill={SKY} stroke={SKYS} />
      <ImgGlyph x={218} y={54} />
    </Frame>
  );
}

/** Compressor: a heavy file shrinks to a light one. */
export function CompressMockup() {
  return (
    <Frame>
      <rect x={66} y={18} width={40} height={84} rx="7" fill={IND} stroke={INDS} strokeWidth="1.5" />
      <Arrow x1={124} x2={188} y={60} />
      <rect x={214} y={66} width={40} height={36} rx="7" fill={SKY} stroke={SKYS} strokeWidth="1.5" />
      <line x1={60} y1={102} x2={260} y2={102} stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
    </Frame>
  );
}

/** Comparator: one file on each side, a similarity gauge + score in the middle. */
export function ComparatorMockup() {
  const r = 27;
  const c = 2 * Math.PI * r;
  return (
    <Frame>
      {/* left file */}
      <Tile x={20} y={36} w={54} h={48} />
      <ImgGlyph x={22} y={38} />
      {/* right file */}
      <Tile x={246} y={36} w={54} h={48} fill={SKY} stroke={SKYS} />
      <ImgGlyph x={248} y={38} />
      {/* dashed links to the centre gauge */}
      <line x1={80} y1={60} x2={126} y2={60} stroke={LINE} strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" />
      <line x1={194} y1={60} x2={240} y2={60} stroke={LINE} strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" />
      {/* centre similarity gauge + score */}
      <circle cx={160} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
      <circle
        cx={160} cy={60} r={r} fill="none" stroke="#38BDF8" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${c * 0.14} ${c}`} transform="rotate(-90 160 60)"
      />
      <text x={160} y={66} textAnchor="middle" fill="#ffffff" fontSize="17" fontWeight="700">12%</text>
    </Frame>
  );
}

/** Variation IA: one source → AI sparkle → several variants. */
export function VariationMockup() {
  return (
    <Frame>
      <Tile x={22} y={38} />
      <ImgGlyph x={22} y={38} />
      <path d="M120 60 l4 -13 l4 13 l13 4 l-13 4 l-4 13 l-4 -13 l-13 -4 z" fill="#818CF8" />
      <Arrow x1={152} x2={198} y={60} />
      <Tile x={214} y={32} w={40} h={38} fill={SKY} stroke={SKYS} />
      <Tile x={236} y={44} w={40} h={38} fill={SKY} stroke={SKYS} />
      <Tile x={258} y={56} w={40} h={38} fill={SKY} stroke={SKYS} />
    </Frame>
  );
}

/** API: your tools → a key → DuupFlow. */
export function ApiMockup() {
  return (
    <Frame>
      {[26, 52, 78].map((yy) => (
        <rect key={yy} x={22} y={yy} width={34} height={20} rx="5" fill={IND} stroke={INDS} strokeWidth="1.5" />
      ))}
      {[36, 62, 88].map((yy) => (
        <line key={yy} x1={58} y1={yy} x2={132} y2={60} stroke={LINE} strokeWidth="1.5" />
      ))}
      {/* key */}
      <circle cx={150} cy={50} r="9" fill="none" stroke="#38BDF8" strokeWidth="3.5" />
      <rect x={148} y={58} width={4} height={22} fill="#38BDF8" />
      <rect x={148} y={70} width={11} height={3.5} fill="#38BDF8" />
      <Arrow x1={172} x2={224} y={60} />
      {/* DuupFlow infinity mark */}
      <circle cx={252} cy={60} r="12" fill="none" stroke="#818CF8" strokeWidth="4" />
      <circle cx={276} cy={60} r="12" fill="none" stroke="#38BDF8" strokeWidth="4" />
    </Frame>
  );
}
