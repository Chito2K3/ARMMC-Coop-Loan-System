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
import { Separator } from '@/components/ui/separator';
import { useFirestore, useUser } from '@/firebase';
import { 
  getLoanTypes, 
  addLoanType, 
  deleteLoanType, 
  getLoanPurposes, 
  addLoanPurpose, 
  deleteLoanPurpose,
  initializeSettings
} from '@/firebase/settings-service';
import { getUser } from '@/firebase/user-service';
import { toast } from '@/hooks/use-toast';
import type { PenaltySettings } from '@/lib/types';
import { Plus, Trash2 } from 'lucide-react';

export default function AdminSettingsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [userRole, setUserRole] = React.useState<string | null>(null);

  const [loanTypes, setLoanTypes] = React.useState<{ id: string, name: string }[]>([]);
  const [loanPurposes, setLoanPurposes] = React.useState<{ id: string, name: string }[]>([]);
  const [newType, setNewType] = React.useState('');
  const [newPurpose, setNewPurpose] = React.useState('');
  const [isUpdatingTypes, setIsUpdatingTypes] = React.useState(false);
  const [isUpdatingPurposes, setIsUpdatingPurposes] = React.useState(false);

  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!firestore) return;
      try {
        await initializeSettings(firestore);
        
        const [types, purposes] = await Promise.all([
          getLoanTypes(firestore),
          getLoanPurposes(firestore)
        ]);

        setLoanTypes(types);
        setLoanPurposes(purposes);

        if (user) {
          const profile = await getUser(firestore, user.uid, user.email || '', user.displayName || '');
          setUserRole(profile?.role || null);
        }
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


  const handleAddType = async () => {
    if (!firestore || !newType.trim()) return;
    setIsUpdatingTypes(true);
    try {
      await addLoanType(firestore, newType.trim());
      const types = await getLoanTypes(firestore);
      setLoanTypes(types);
      setNewType('');
      toast({ title: 'Success', description: 'Loan type added.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add loan type.' });
    } finally {
      setIsUpdatingTypes(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!firestore) return;
    setIsUpdatingTypes(true);
    try {
      await deleteLoanType(firestore, id);
      const types = await getLoanTypes(firestore);
      setLoanTypes(types);
      toast({ title: 'Success', description: 'Loan type removed.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove loan type.' });
    } finally {
      setIsUpdatingTypes(false);
    }
  };

  const handleAddPurpose = async () => {
    if (!firestore || !newPurpose.trim()) return;
    setIsUpdatingPurposes(true);
    try {
      await addLoanPurpose(firestore, newPurpose.trim());
      const purposes = await getLoanPurposes(firestore);
      setLoanPurposes(purposes);
      setNewPurpose('');
      toast({ title: 'Success', description: 'Loan purpose added.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add loan purpose.' });
    } finally {
      setIsUpdatingPurposes(false);
    }
  };

  const handleDeletePurpose = async (id: string) => {
    if (!firestore) return;
    setIsUpdatingPurposes(true);
    try {
      await deleteLoanPurpose(firestore, id);
      const purposes = await getLoanPurposes(firestore);
      setLoanPurposes(purposes);
      toast({ title: 'Success', description: 'Loan purpose removed.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove loan purpose.' });
    } finally {
      setIsUpdatingPurposes(false);
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
          <CardTitle>Loan Dynamic Settings</CardTitle>
          <CardDescription>
            Manage dynamic lists for Loan Types and Purposes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Loan Types */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Type of Loan</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Regular, Salary Loan, etc."
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                disabled={isUpdatingTypes}
              />
              <Button onClick={handleAddType} disabled={isUpdatingTypes || !newType.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {loanTypes.map((type) => (
                <div key={type.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md border group">
                  <span className="text-sm truncate mr-2">{type.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteType(type.id)}
                    disabled={isUpdatingTypes}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Loan Purposes */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Purpose of Loan</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Business Capital, Medical, etc."
                value={newPurpose}
                onChange={(e) => setNewPurpose(e.target.value)}
                disabled={isUpdatingPurposes}
              />
              <Button onClick={handleAddPurpose} disabled={isUpdatingPurposes || !newPurpose.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {loanPurposes.map((purpose) => (
                <div key={purpose.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md border group">
                  <span className="text-sm truncate mr-2">{purpose.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeletePurpose(purpose.id)}
                    disabled={isUpdatingPurposes}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
