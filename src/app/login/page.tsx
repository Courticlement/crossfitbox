import { CoachLoginForm } from "@/components/coach-login-form";

export default function CoachLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <h1 className="mb-6 text-lg font-semibold text-white">Crossfit Box — Mes cours</h1>
      <CoachLoginForm />
    </div>
  );
}
