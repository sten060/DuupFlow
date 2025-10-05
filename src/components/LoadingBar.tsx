"use client";
import { useEffect, useState } from "react";

export default function LoadingBar({ show }: { show: boolean }) {
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!show) { setW(0); return; }
    let t: any;
    const tick = () => {
      setW((prev) => (prev < 90 ? prev + Math.random() * 8 : prev)); // plafonne ~90%
      t = setTimeout(tick, 300);
    };
    tick();
    return () => clearTimeout(t);
  }, [show]);

  return (
    <div className="fixed left-0 right-0 top-0 z-50 h-[3px] bg-transparent">
      <div
        className="h-full bg-indigo-500 transition-[width] duration-300"
        style={{ width: `${show ? w : 0}%` }}
      />
    </div>
  );
}