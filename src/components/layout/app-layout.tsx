import { Sidebar } from "@/components/layout/sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
