import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateWIB(
  input: Date | string | number,
  options: { withTime?: boolean; withSeconds?: boolean } = {}
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const { withTime = true, withSeconds = false } = options;

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
  };

  if (withTime) {
    formatOptions.hour = "2-digit";
    formatOptions.minute = "2-digit";
    formatOptions.hour12 = false;
    if (withSeconds) {
      formatOptions.second = "2-digit";
    }
  }

  return new Intl.DateTimeFormat("id-ID", formatOptions).format(date);
}

export function formatPercentage(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  const safeValue = Object.is(value, -0) || value === 0 ? 0 : value;

  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeValue)}%`;
}
