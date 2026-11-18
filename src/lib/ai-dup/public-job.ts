// src/lib/ai-dup/public-job.ts — ce que le navigateur reçoit d'un ticket :
// pas d'id user, pas de plan interne, une URL de téléchargement par copie.

import type { AiDupJob } from "./types";

export function publicJob(job: AiDupJob) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    mode: job.request.mode,
    requested: job.request.copies,
    notices: job.notices,
    error: job.error,
    finished: !!job.finishedAt,
    startedAt: job.startedAt,
    tokensCents: job.tokensCents ?? null,
    copies: job.copies.map((c) => ({
      index: c.index,
      status: c.status,
      attempts: c.attempts,
      summary: c.summary ?? null,
      error: c.error ?? null,
      retryReason: c.retryReason ?? null,
      fileName: c.expired ? null : c.fileName ?? null,
      sizeBytes: c.sizeBytes ?? null,
      expired: !!c.expired,
      url: c.fileName && !c.expired ? `/api/out/${encodeURIComponent(job.storeKey)}/${encodeURIComponent(c.fileName)}` : null,
    })),
  };
}

export type PublicAiDupJob = ReturnType<typeof publicJob>;
