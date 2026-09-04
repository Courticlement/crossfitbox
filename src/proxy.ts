import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, COACH_COOKIE, verifyAdminSessionToken, verifyCoachSessionToken } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
    if (!session) return redirectTo(req, "/admin-login");
    // A PLATFORM_SUPERADMIN belongs to no box — they manage Organizations
    // from /superadmin instead and never see a box's own /admin.
    if (session.organizationId === null) return redirectTo(req, "/superadmin");
    if (pathname.startsWith("/admin/admins") && session.role !== "SUPERADMIN") {
      return redirectTo(req, "/admin");
    }
  }

  if (pathname.startsWith("/superadmin")) {
    const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
    if (!session) return redirectTo(req, "/admin-login");
    // An org admin has nothing to do on the platform-level screen.
    if (session.organizationId !== null) return redirectTo(req, "/admin");
  }

  if (pathname.startsWith("/upload")) {
    const coachSession = await verifyCoachSessionToken(req.cookies.get(COACH_COOKIE)?.value);
    if (!coachSession) return redirectTo(req, "/login");
  }

  return NextResponse.next();
}

function redirectTo(req: NextRequest, path: string) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/superadmin/:path*", "/upload/:path*"],
};
