import { AdminTabs } from "@/components/admin/tabs";
import { Nav } from "@/components/nav";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Admin</h1>
        <div className="mt-4">
          <AdminTabs />
        </div>
        <div className="mt-6">{children}</div>
      </main>
    </>
  );
}
