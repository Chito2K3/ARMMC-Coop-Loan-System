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
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/60 hover:bg-amber-100",
    approved:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800/60 hover:bg-green-100",
    denied:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/60 hover:bg-red-100",
    released:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/60 hover:bg-blue-100",
    "fully-paid":
      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/60 hover:bg-purple-100",
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
