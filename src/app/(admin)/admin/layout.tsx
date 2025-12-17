"use client";


import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

//config
export const dynamic = "force-dynamic";

// ============================================================================
// AdminLayout Component
// ============================================================================

/**
 * AdminLayout - Layout wrapper for the admin dashboard.
 *
 * Features:
 * - Admin authentication check (redirects non-admins)
 * - Collapsible sidebar with shadcn components
 * - Responsive header with breadcrumbs
 * - Loading state while checking auth
 *
 * Security:
 * - Verifies user has admin platform_role
 * - Redirects unauthenticated users to login
 * - Redirects non-admin users to main dashboard
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Check if user is admin
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/admin");
      return;
    }

    // Check if user has admin platform role
    const userRole =
      (session?.user as any)?.platform_role || (session?.user as any)?.role;

    if (userRole !== "admin") {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated or not admin
  const userRole =
    (session?.user as any)?.platform_role || (session?.user as any)?.role;
  if (status === "unauthenticated" || userRole !== "admin") {
    return null;
  }

  // Prepare user data for sidebar
  const user = {
    name: session?.user?.name || "Admin",
    email: session?.user?.email || "admin@example.com",
    avatar: session?.user?.image || "",
  };

  return (
    <SidebarProvider>
      {/* Sidebar */}
      <AppSidebar user={user} />

      {/* Main Content Area */}
      <SidebarInset>
        {/* Header */}
        <SiteHeader />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
