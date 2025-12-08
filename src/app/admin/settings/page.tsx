'use client';

import * as React from 'react';
import { ChevronLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useUser } from '@/firebase';
import { getPenaltySettings, updatePenaltySettings } from '@/firebase/penalty-service';
import { toast } from '@/hooks/use-toast';
import type { PenaltySettings } from '@/lib/types';

export default function AdminSettingsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [settings, setSettings] = React.useState<PenaltySettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [penaltyAmount, setPenaltyAmount] = React.useState('500');
  const [gracePeriodDays, setGracePeriodDays] = React.useState('3');

  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!firestore) return;
      try {
        const data = await getPenaltySettings(firestore);
        setSettings(data);
        setPenaltyAmount(String(data.penaltyAmount));
        setGracePeriodDays(String(data.gracePeriodDays));
      } catch (error) {
        console.error('Error loading settings:', error);
        setError('Failed to load settings.');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load settings.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [firestore]);

  const handleSave = async () => {
    if (!firestore || !user) return;

    setIsSaving(true);
    try {
      await updatePenaltySettings(
        firestore,
        Number(penaltyAmount),
        Number(gracePeriodDays),
        user.uid
      );
      toast({
        title: 'Success',
        description: 'Penalty settings updated successfully.',
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage system configuration</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Penalty Configuration</CardTitle>
          <CardDescription>
            Set the penalty amount and grace period for late payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="penalty" className="text-base font-semibold">
                    Penalty Amount (₱)
                  </Label>
                  <Input
                    id="penalty"
                    type="number"
                    value={penaltyAmount}
                    onChange={(e) => setPenaltyAmount(e.target.value)}
                    className="h-11 text-base"
                    placeholder="500"
                  />
                  <p className="text-xs text-muted-foreground">
                    Amount charged for late payments
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grace" className="text-base font-semibold">
                    Grace Period (Days)
                  </Label>
                  <Input
                    id="grace"
                    type="number"
                    value={gracePeriodDays}
                    onChange={(e) => setGracePeriodDays(e.target.value)}
                    className="h-11 text-base"
                    placeholder="3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Days allowed before penalty applies
                  </p>
                </div>
              </div>

              {settings && (
                <div className="pt-4 border-t space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(settings.updatedAt instanceof Date ? settings.updatedAt : settings.updatedAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Updated by: {settings.updatedBy}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
