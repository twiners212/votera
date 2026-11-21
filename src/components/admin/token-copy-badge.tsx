"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface TokenCopyBadgeProps {
  token: string | null;
  hasVoted?: boolean;
  className?: string;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand below
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function TokenCopyBadge({
  token,
  hasVoted = false,
  className,
}: TokenCopyBadgeProps) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (hasVoted || !token) {
    return (
      <span
        className={cn(
          "inline-flex items-center text-sm font-medium text-[#94A3B8]",
          className
        )}
        title="Token hangus karena pemilih sudah menggunakan hak suaranya"
      >
        —
      </span>
    );
  }

  async function handleCopy() {
    if (!token || hasVoted) return;
    const ok = await copyTextToClipboard(token);
    if (!ok) {
      toast.error("Gagal menyalin token ke clipboard");
      return;
    }

    setCopied(true);
    toast.success("Token berhasil disalin ke clipboard");

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setCopied(false);
    }, 2_000);
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <code className="rounded-[6px] border border-[#E2E8F0] bg-[#F1F5F9] px-2.5 py-1 font-mono text-xs font-semibold tracking-wider text-[#0F172A]">
        {token}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Salin token ${token}`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/30",
          copied
            ? "text-[#15803D]"
            : "text-[#D93829] hover:bg-[#FFF0EE] hover:text-[#B8281B]"
        )}
      >
        {copied ? (
          <>
            <span>Tersalin</span>
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </>
        ) : (
          <>
            <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Salin</span>
          </>
        )}
      </button>
    </div>
  );
}
