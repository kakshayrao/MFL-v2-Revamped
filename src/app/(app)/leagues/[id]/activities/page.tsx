'use client';

import React, { use, useMemo } from 'react';
import {
  Dumbbell,
  Plus,
  Check,
  Loader2,
  RefreshCw,
  AlertCircle,
  Shield,
  Info,
  Filter,
  Search,
} from 'lucide-react';

import { useRole } from '@/contexts/role-context';
import { useLeague } from '@/contexts/league-context';
import { useLeagueActivities } from '@/hooks/use-league-activities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// League Activities Page
// ============================================================================

export default function LeagueActivitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = use(params);
  const { isHost, isGovernor } = useRole();
  const { activeLeague } = useLeague();

  // Host/Governor can see all activities to configure
  const isAdmin = isHost || isGovernor;
  const { data, isLoading, error, refetch, addActivities, removeActivity } =
    useLeagueActivities(leagueId, { includeAll: isAdmin });

  const [toggleLoading, setToggleLoading] = React.useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  const enabledActivityIds = React.useMemo(() => {
    return new Set(data?.activities.map((a) => a.activity_id) || []);
  }, [data?.activities]);

  // Extract unique categories
  const categories = useMemo(() => {
    if (!data) return [];
    const allActivities = isAdmin ? data.allActivities || [] : data.activities;
    const categoryMap = new Map();
    
    allActivities.forEach((activity) => {
      if (activity.category) {
        categoryMap.set(activity.category.category_id, activity.category);
      }
    });

    return Array.from(categoryMap.values()).sort((a, b) => 
      a.display_name.localeCompare(b.display_name)
    );
  }, [data, isAdmin]);

  // Filter activities by selected category
  const filteredActivities = useMemo(() => {
    if (!data) return [];
    const activities = isAdmin ? data.allActivities || [] : data.activities;
    const search = searchTerm.trim().toLowerCase();

    return activities.filter((a) => {
      const matchesCategory = selectedCategory === 'all' || a.category?.category_id === selectedCategory;
      const matchesSearch =
        !search ||
        a.activity_name.toLowerCase().includes(search) ||
        (a.description || '').toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [data, selectedCategory, searchTerm, isAdmin]);

  const sortedActivities = useMemo(() => {
    const list = [...filteredActivities];
    return list.sort((a, b) => {
      const aEnabled = enabledActivityIds.has(a.activity_id) ? 1 : 0;
      const bEnabled = enabledActivityIds.has(b.activity_id) ? 1 : 0;
      if (aEnabled !== bEnabled) return bEnabled - aEnabled; // enabled first
      return a.activity_name.localeCompare(b.activity_name);
    });
  }, [filteredActivities, enabledActivityIds]);

  const handleToggle = async (activityId: string, enable: boolean) => {
    setToggleLoading(activityId);
    try {
      let success = false;
      if (enable) {
        success = await addActivities([activityId]);
        if (success) {
          toast.success('Activity enabled');
        }
      } else {
        success = await removeActivity(activityId);
        if (success) {
          toast.success('Activity disabled');
        }
      }
      if (!success) {
        toast.error('Failed to update activity');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setToggleLoading(null);
    }
  };

  // no-op bulk handlers (removed UI); using original per-item toggle UX

  // Regular users just see enabled activities
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6 py-4 md:py-6">
        {/* Header */}
        <div className="flex flex-col gap-4 px-4 lg:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                <Dumbbell className="size-6 text-primary" />
                Allowed Activities
              </h1>
              <p className="text-muted-foreground">
                View activities you can submit for this league
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-52">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search activities"
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {categories.length > 0 && (
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 size-4" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.category_id} value={cat.category_id}>
                        {cat.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 lg:px-6">
          {isLoading && <LoadingSkeleton />}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && data && (
            <>
              {filteredActivities.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Dumbbell className="size-8 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg font-semibold mb-2">
                      {selectedCategory === 'all' 
                        ? 'No Activities Configured'
                        : 'No Activities in This Category'}
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {selectedCategory === 'all'
                        ? 'The league host hasn\'t configured any activities yet. Contact your league host to enable activities.'
                        : 'No activities found in the selected category.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredActivities.map((activity) => (
                    <Card key={activity.activity_id} className="border-primary/50 bg-primary/5">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Check className="size-4 text-primary" />
                          {activity.activity_name}
                        </CardTitle>
                        {activity.category && (
                          <Badge variant="outline" className="w-fit">
                            {activity.category.display_name}
                          </Badge>
                        )}
                        {activity.description && (
                          <CardDescription className="text-sm">
                            {activity.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Admin view (host/governor)
  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Dumbbell className="size-6 text-primary" />
              Configure Activities
            </h1>
            <p className="text-muted-foreground">
              Enable or disable activities for your league
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search activities"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {categories.length > 0 && (
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 size-4" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.category_id} value={cat.category_id}>
                      {cat.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Badge variant="outline">
              {data?.activities.length || 0} Active
            </Badge>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 lg:px-6 space-y-6">
        {isLoading && <LoadingSkeleton />}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && data && (
          <>
            {/* Info Alert */}
            <Alert>
              <Info className="size-4" />
              <AlertTitle>Activity Configuration</AlertTitle>
              <AlertDescription>
                Enable activities that players can submit for this league.
                Players cannot submit workouts until you enable at least one
                activity type.
                {data.activities.length === 0 && (
                  <span className="block mt-2 font-medium text-amber-600">
                    ⚠️ No activities are currently enabled. Players cannot submit
                    workouts.
                  </span>
                )}
              </AlertDescription>
            </Alert>

            {/* Host: original toggle grid, with enabled items sorted to the top */}
            {isHost && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedActivities.map((activity) => {
                  const isEnabled = enabledActivityIds.has(activity.activity_id);
                  const isProcessing = toggleLoading === activity.activity_id;

                  return (
                    <div
                      key={activity.activity_id}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-lg border transition-all cursor-pointer',
                        isEnabled
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-card hover:border-primary/50',
                        isProcessing && 'opacity-50 pointer-events-none'
                      )}
                      onClick={() =>
                        !isProcessing &&
                        handleToggle(activity.activity_id, !isEnabled)
                      }
                    >
                      <div className="pt-0.5">
                        {isProcessing ? (
                          <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        ) : (
                          <Checkbox
                            checked={isEnabled}
                            disabled={isProcessing}
                            className="pointer-events-none"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm leading-tight">
                            {activity.activity_name}
                          </p>
                          {activity.category && (
                            <Badge variant="outline" className="text-xs">
                              {activity.category.display_name}
                            </Badge>
                          )}
                        </div>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {activity.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Governor: read-only enabled activities */}
            {isGovernor && !isHost && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredActivities
                  .filter((a) => enabledActivityIds.has(a.activity_id))
                  .map((activity) => (
                    <Card key={activity.activity_id} className="border-primary/50 bg-primary/5">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Check className="size-4 text-primary" />
                          {activity.activity_name}
                        </CardTitle>
                        {activity.category && (
                          <Badge variant="outline" className="w-fit">
                            {activity.category.display_name}
                          </Badge>
                        )}
                        {activity.description && (
                          <CardDescription className="text-sm">
                            {activity.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  ))}
              </div>
            )}

            {/* Warning if no activities enabled */}
            {isHost && data.activities.length === 0 && data.allActivities && data.allActivities.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Action Required</AlertTitle>
                <AlertDescription>
                  Players will not be able to submit workouts until you enable
                  at least one activity type. Click on any activity above to
                  enable it.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </div>
    </div>
  );
}
