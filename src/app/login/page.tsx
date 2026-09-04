import { prisma } from "@/lib/prisma";
import { CoachLoginForm } from "@/components/coach-login-form";

// Coach.name is only unique within an organization, not globally (two boxes
// can each have a coach with the same name) — the login form needs the
// coach to pick their box first. This list is just names, safe to expose
// without authentication.
export default async function CoachLoginPage() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <h1 className="mb-6 text-lg font-semibold text-white">Crossfit Box — Mes cours</h1>
      <CoachLoginForm organizations={organizations} />
    </div>
  );
}
