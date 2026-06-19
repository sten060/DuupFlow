"use client";

export type UploadResult = {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
};

/**
 * POST a file with REAL upload-progress events.
 *
 * `fetch()` cannot report upload progress; XMLHttpRequest can (upload.onprogress).
 * Returns the small slice of the fetch `Response` the callers actually use
 * (`.ok` / `.status` / `.json()` / `.text()`), so it's a drop-in replacement for
 * `await fetch(url, { method:"POST", body, signal })`. Rejects with an AbortError
 * (DOMException) on abort — matching fetch — so existing stop/timeout handling works.
 */
export function uploadWithProgress(
  url: string,
  body: Blob,
  opts: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {},
): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.responseType = "text";

    if (opts.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          opts.onProgress!(Math.min(1, e.loaded / e.total));
        }
      };
    }

    const onAbort = () => { try { xhr.abort(); } catch {} };
    if (opts.signal) {
      if (opts.signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }
    const cleanup = () => opts.signal?.removeEventListener("abort", onAbort);

    xhr.onload = () => {
      cleanup();
      const responseText = xhr.responseText ?? "";
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: async () => responseText,
        json: async () => JSON.parse(responseText),
      });
    };
    xhr.onerror = () => { cleanup(); reject(new TypeError("Network request failed")); };
    xhr.ontimeout = () => { cleanup(); reject(new TypeError("Upload timed out")); };
    xhr.onabort = () => { cleanup(); reject(new DOMException("Aborted", "AbortError")); };

    xhr.send(body);
  });
}
