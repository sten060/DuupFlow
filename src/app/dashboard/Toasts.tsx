'use client';

import * as React from 'react';

export default function Toasts({ ok, err }: { ok?: boolean; err?: string }) {
  const [show, setShow] = React.useState<boolean>(!!ok || !!err);

  React.useEffect(() => {
    if (ok || err) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 3500);
      return () => clearTimeout(t);
    }
  }, [ok, err]);

  if (!show) return null;

  const isError = !!err;
  const msg = err ? decodeURIComponent(err) : 'Duplication terminée ✔️';

  return (
    <div className="fixed right-4 top-4 z-[9999]">
      <div
        className={
          'rounded-lg px-4 py-3 text-sm shadow-xl ' +
          (isError
            ? 'bg-rose-600/90 text-white'
            : 'bg-emerald-600/90 text-white')
        }
      >
        {msg}
      </div>
    </div>
  );
}