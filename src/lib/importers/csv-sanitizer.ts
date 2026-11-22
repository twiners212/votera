/**
 * Check if a cell string starts with spreadsheet formula triggers (=, +, -, @, \t, \r).
 * Handles leading whitespace and control characters (CWE-1236 protection).
 */
export function hasCsvFormulaPrefix(val: unknown): boolean {
  if (typeof val !== "string") {
    return false;
  }
  // Check leading control characters and symbols before trimming
  if (/^[=+\-@\t\r]/.test(val)) {
    return true;
  }
  // Check leading symbols after trimming leading spaces
  const trimmed = val.trim();
  return /^[=+\-@]/.test(trimmed);
}

/**
 * Escape formula injection in spreadsheet export by prepending single apostrophe (')
 * if the string starts with formula triggers.
 */
export function escapeSpreadsheetCell(val: unknown): string {
  if (val === null || val === undefined) {
    return "";
  }
  const str = String(val);
  if (hasCsvFormulaPrefix(str)) {
    return `'${str}`;
  }
  return str;
}
