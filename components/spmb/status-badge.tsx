
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SPMBStatusBadgeProps {
  status: string;
  className?: string;
}

export function SPMBStatusBadge({ status, className }: SPMBStatusBadgeProps) {
  const styles = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    verified: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  };

  const labels: Record<string, string> = {
    pending: "Pending",
    verified: "Terverifikasi",
    accepted: "Diterima",
    rejected: "Ditolak",
    draft: "Draft"
  };

  const key = status?.toLowerCase() as keyof typeof styles;
  const style = styles[key] || styles.pending;
  const label = labels[key] || status;

  return (
    <Badge variant="outline" className={cn(style, "capitalize", className)}>
      {label}
    </Badge>
  );
}
