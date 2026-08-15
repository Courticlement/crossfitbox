import { AdminLoginForm } from "@/components/admin-login-form";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <h1 className="mb-6 text-lg font-semibold text-white">Crossfit Box — Admin</h1>
      <AdminLoginForm />
    </div>
  );
}
