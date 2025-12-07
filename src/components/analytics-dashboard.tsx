'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Loan, Payment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const formatAmount = (amount: number) => {
  if (amount >= 1000000) {
    return `₱${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `₱${(amount / 1000).toFixed(1)}K`;
  }
  return `₱${amount.toFixed(0)}`;
};

export function AnalyticsDashboard() {
  const firestore = useFirestore();

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'loans'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: loans, isLoading: loansLoading } = useCollection<Loan>(loansQuery);

  const metrics = useMemo(() => {
    if (!loans) return null;

    const totalLoans = loans.length;
    const totalAmount = loans.reduce((sum, loan) => sum + loan.amount, 0);
    const pendingLoans = loans.filter(l => l.status === 'pending').length;
    const approvedLoans = loans.filter(l => l.status === 'approved').length;
    const releasedLoans = loans.filter(l => l.status === 'released').length;
    const fullyPaidLoans = loans.filter(l => l.status === 'fully-paid').length;
    const deniedLoans = loans.filter(l => l.status === 'denied').length;

    const statusData = [
      { name: 'Pending', value: pendingLoans },
      { name: 'Approved', value: approvedLoans },
      { name: 'Released', value: releasedLoans },
      { name: 'Fully Paid', value: fullyPaidLoans },
      { name: 'Denied', value: deniedLoans },
    ].filter(item => item.value > 0);

    const loanTypeData = loans.reduce((acc: any[], loan) => {
      const existing = acc.find(item => item.name === loan.loanType);
      if (existing) {
        existing.value += 1;
        existing.amount += loan.amount;
      } else {
        acc.push({ name: loan.loanType, value: 1, amount: loan.amount });
      }
      return acc;
    }, []);

    const monthlyData = loans.reduce((acc: any[], loan) => {
      const date = loan.createdAt && (loan.createdAt as any).toDate
        ? (loan.createdAt as any).toDate()
        : new Date();
      const month = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      const existing = acc.find(item => item.month === month);
      if (existing) {
        existing.count += 1;
        existing.amount += loan.amount;
      } else {
        acc.push({ month, count: 1, amount: loan.amount });
      }
      return acc;
    }, []).slice(-6);

    return {
      totalLoans,
      totalAmount,
      pendingLoans,
      approvedLoans,
      releasedLoans,
      fullyPaidLoans,
      deniedLoans,
      statusData,
      loanTypeData,
      monthlyData,
    };
  }, [loans]);

  if (loansLoading || !metrics) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalLoans}</div>
            <p className="text-xs text-muted-foreground">All applications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(metrics.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground">Disbursed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingLoans}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fully Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.fullyPaidLoans}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Status Distribution</CardTitle>
            <CardDescription>Current status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Loan Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Type Distribution</CardTitle>
            <CardDescription>By type and count</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.loanTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Loan Disbursement</CardTitle>
          <CardDescription>Last 6 months trend</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="count" stroke="#8b5cf6" name="Count" />
              <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#ec4899" name="Amount (₱)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
