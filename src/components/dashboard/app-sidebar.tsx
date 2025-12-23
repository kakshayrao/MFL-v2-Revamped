"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Trophy,
  FileCheck,
  DollarSign,
  Activity,
  Flag,
  Settings,
  Tag,
  Dumbbell,
  HelpCircle,
  Shield,
} from "lucide-react";

import { NavMain } from "@/components/dashboard/nav-main";
import { NavSecondary } from "@/components/dashboard/nav-secondary";
import { NavUser } from "@/components/dashboard/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// ============================================================================
// Navigation Configuration
// ============================================================================

/**
 * Main admin navigation items.
 * These map to the existing admin routes.
 */
const adminNavItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Leagues",
    url: "/admin/leagues",
    icon: Trophy,
  },
  {
    title: "Challenges",
    url: "/admin/challenges",
    icon: Dumbbell,
  },
  {
    title: "Revenue",
    url: "/admin/revenue",
    icon: DollarSign,
  },
  {
    title: "Pricing",
    url: "/admin/pricing",
    icon: Tag,
  },
  {
    title: "Activities",
    url: "/admin/activities",
    icon: Activity,
  },
  {
    title: "Roles",
    url: "/admin/roles",
    icon: Shield,
  },
];

/**
 * Secondary navigation items (bottom of sidebar).
 */
const secondaryNavItems = [
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
  {
    title: "Help",
    url: "#",
    icon: HelpCircle,
  },
];

// ============================================================================
// AppSidebar Component
// ============================================================================

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
}

/**
 * AppSidebar - Admin dashboard sidebar component.
 *
 * Features:
 * - Collapsible sidebar with icon mode
 * - Main navigation with active state
 * - Secondary navigation at bottom
 * - User profile with dropdown menu
 */
export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname();

  // Add active state to nav items based on current path
  const navItemsWithActive = adminNavItems.map((item) => ({
    ...item,
    isActive:
      pathname === item.url ||
      (item.url !== "/admin" && pathname?.startsWith(item.url)),
  }));

  const secondaryItemsWithActive = secondaryNavItems.map((item) => ({
    ...item,
    isActive: pathname === item.url,
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header - Brand */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/admin">
                <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
                  <Dumbbell className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Admin Panel</span>
                  <span className="truncate text-xs text-muted-foreground">
                    My Fitness League
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content - Navigation */}
      <SidebarContent>
        <NavMain items={navItemsWithActive} />
        <NavSecondary items={secondaryItemsWithActive} className="mt-auto" />
      </SidebarContent>

      {/* Footer - User */}
      <SidebarFooter>
        <NavUser
          user={
            user || {
              name: "Admin",
              email: "admin@example.com",
              avatar: "",
            }
          }
        />
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
