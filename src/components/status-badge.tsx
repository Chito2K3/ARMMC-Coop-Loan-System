import { Badge } from "@/components/ui/badge";
import type { LoanStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: LoanStatus;
  className?: string;
}) {
  const statusClasses = {
    pending:
      "bg-amber-500/15 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
    approved:
      "bg-emerald-500/15 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
    denied:
      "bg-rose-500/15 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30",
    released:
      "bg-indigo-500/15 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30",
    "fully-paid":
      "bg-violet-500/15 text-violet-600 border-violet-500/20 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30",
  };

  return (
    <Badge
      variant="outline"
      className={cn("capitalize font-medium", statusClasses[status], className)}
    >
      {status.replace('-', ' ')}
    </Badge>
  );
}
