import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AshbyConnectionForm } from "@/components/ashby/AshbyConnectionForm";
import { AshbyPushHistory } from "@/components/ashby/AshbyPushHistory";

export const metadata = {
  title: "Settings — Scout",
  description: "Manage your Scout integrations and settings.",
};

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/api/auth/signin?callbackUrl=/settings");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
        Settings
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Manage your integrations and account settings.
      </p>

      {/* Ashby ATS */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Ashby ATS
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Connect your Ashby account to push candidates directly from Scout.
        </p>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
          <AshbyConnectionForm />
        </div>
      </section>

      {/* Push History */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Push History
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Developers you&apos;ve pushed to Ashby.
        </p>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
          <AshbyPushHistory />
        </div>
      </section>
    </div>
  );
}
