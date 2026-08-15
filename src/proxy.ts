import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, COACH_COOKIE, verifyAdminSessionToken, verifyCoachSessionToken } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const ok = await verifyAdminSessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
    if (!ok) return redirectTo(req, "/admin-login");
  }

  if (pathname.startsWith("/upload")) {
    const coachId = await verifyCoachSessionToken(req.cookies.get(COACH_COOKIE)?.value);
    if (!coachId) return redirectTo(req, "/login");
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
  matcher: ["/admin/:path*", "/upload/:path*"],
};
