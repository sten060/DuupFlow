'use client';

import { useEffect } from 'react';
import { pushNotification } from './components/notificationStore';

/**
 * Legacy server-action result toasts (?ok / ?err / ?warn on the videos & images
 * pages). Instead of floating top-right, they now feed the notification bell so
 * every notification on DuupFlow comes out of the same place. Renders nothing.
 */
export default function Toasts({ ok, err, warn }: { ok?: boolean; err?: string; warn?: string }) {
  useEffect(() => {
    if (err) {
      pushNotification({ kind: 'error', title: 'Erreur', body: decodeURIComponent(err) });
    } else if (warn) {
      pushNotification({ kind: 'info', title: 'Attention', body: decodeURIComponent(warn) });
    } else if (ok) {
      pushNotification({ kind: 'success', title: 'Duplication terminée ✔️' });
    }
    // Only re-fire if the actual values change.
  }, [ok, err, warn]);

  return null;
}
