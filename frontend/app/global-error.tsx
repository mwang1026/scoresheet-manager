"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body style={{ background: "#1a1816", color: "#e8e4df" }}>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Something went wrong!</h2>
            <p className="mt-2 text-sm" style={{ color: "#7a7470" }}>{error.message}</p>
            <button
              onClick={reset}
              className="mt-4 rounded-md px-4 py-2 text-sm font-medium"
              style={{ background: "#d4a54a", color: "#1a1816" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
