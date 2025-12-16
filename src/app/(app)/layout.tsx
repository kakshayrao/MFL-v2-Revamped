'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { LeagueProvider } from '@/contexts/league-context';
import { RoleProvider } from '@/contexts/role-context';
import { AppSidebar } from '@/components/app/app-sidebar';
import { AppHeader } from '@/components/app/app-header';
import { MobileBottomTabs } from '@/components/app/mobile-bottom-tabs';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

// ============================================================================
// AppLayout Component
// ============================================================================

/**
 * AppLayout - Unified layout for all user-facing pages.
 *
 * Features:
 * - Authentication check (redirects to login if not authenticated)
 * - LeagueContext and RoleContext providers
 * - Dynamic sidebar based on role/context
 * - Header with breadcrumbs and role switcher
 * - Mobile bottom tabs navigation
 * - Loading state while checking auth
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/dashboard');
    }
  }, [status, router]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (status === 'unauthenticated') {
    return null;
  }

  // Prepare user data for sidebar
  const user = {
    name: session?.user?.name || 'User',
    email: session?.user?.email || 'user@example.com',
    avatar: session?.user?.image || '',
  };

  return (
    <LeagueProvider>
      <RoleProvider>
        <SidebarProvider>
          {/* Sidebar - Hidden on mobile */}
          <AppSidebar user={user} className="hidden md:flex" />

          {/* Main Content Area */}
          <SidebarInset className="flex flex-col h-screen">
            {/* Header */}
            <AppHeader />

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
              {children}
            </main>
          </SidebarInset>

          {/* Mobile Bottom Tabs */}
          <MobileBottomTabs />
        </SidebarProvider>
      </RoleProvider>
    </LeagueProvider>
  );
}
