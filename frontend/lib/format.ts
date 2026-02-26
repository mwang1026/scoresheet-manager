/**
 * Shared formatting utilities.
 */

/**
 * Format an ISO 8601 datetime string for display.
 * Example: "Mar 15, 13:00 (MDT)"
 */
export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const tz = date
      .toLocaleTimeString("en-US", { timeZoneName: "short" })
      .split(" ")
      .pop();
    return `${month} ${day}, ${hours}:${minutes} (${tz})`;
  } catch {
    return "";
  }
}

/**
 * Check whether a datetime string is within the given number of hours from now.
 */
export function isWithinHours(isoString: string, hours: number): boolean {
  try {
    const pickTime = new Date(isoString).getTime();
    const now = Date.now();
    return Math.abs(pickTime - now) <= hours * 3600000;
  } catch {
    return false;
  }
}
