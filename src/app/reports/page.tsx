import { AnalyticsDashboard } from '@/components/analytics-dashboard';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-2">
            View loan analytics and performance metrics.
          </p>
        </div>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
