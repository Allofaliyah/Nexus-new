
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Activity,
  FileText,
  Bell,
  ShieldAlert,
  UserRound,
  Package,
  Menu,
  X,
} from "lucide-react";
import ProtectedRoute from "@/app/components/auth/ProtectedRoute";
import { AdminProvider } from "@/app/context/AdminContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menu = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Activity", href: "/admin/activity", icon: Activity },
    { name: "Logs", href: "/admin/logs", icon: FileText },
    { name: "Alerts", href: "/admin/alerts", icon: Bell },
    { name: "Incidents", href: "/admin/incidents", icon: ShieldAlert },
    { name: "Orders", href: "/admin/orders", icon: Package },
    { name: "Profile", href: "/admin/profile", icon: UserRound },
  ];

  return (
    <ProtectedRoute allowedRole="admin">
      <AdminProvider>
        <div className="min-h-screen bg-gray-50 md:flex">
          {/* Mobile header */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 md:hidden">
            <Link
              href="/admin"
              className="text-xl font-bold tracking-wide text-gray-900"
            >
              NEXUS
            </Link>

            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={sidebarOpen}
              aria-controls="admin-sidebar"
              className="inline-flex size-10 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </header>

          {/* Mobile backdrop */}
          {sidebarOpen && (
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
            />
          )}

          {/* Sidebar */}
          <aside
            id="admin-sidebar"
            className={`fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r bg-white p-5 transition-transform duration-300 ease-in-out md:sticky md:top-0 md:z-20 md:h-screen md:translate-x-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-10 flex items-center justify-between">
              <Link
                href="/admin"
                onClick={() => setSidebarOpen(false)}
                className="text-2xl font-bold tracking-wide text-gray-900"
              >
                NEXUS
              </Link>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
              >
                <X size={22} />
              </button>
            </div>

            <nav aria-label="Admin navigation" className="space-y-2">
              {menu.map((item) => {
                const Icon = item.icon;

                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                      isActive
                        ? "bg-blue-50 font-medium text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">
            {children}
          </main>
        </div>
      </AdminProvider>
    </ProtectedRoute>
  );
}
