import { Image, FileCode, FileText, File, FileSpreadsheet } from "lucide-react";

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("python") ||
    mimeType.includes("json") ||
    mimeType.includes("html") ||
    mimeType.includes("css")
  )
    return FileCode;
  if (mimeType.includes("spreadsheet") || mimeType === "text/csv")
    return FileSpreadsheet;
  if (mimeType.startsWith("text/") || mimeType === "application/pdf")
    return FileText;
  return File;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "ready":
      return "text-status-completed border-status-completed/30";
    case "processing":
      return "text-status-running border-status-running/30";
    case "error":
      return "text-status-failed border-status-failed/30";
    case "uploaded":
      return "text-status-warning border-status-warning/30";
    default:
      return "";
  }
}
