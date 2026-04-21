import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next internal assets and the favicon
     *  - static image files
     *  - /api/webhooks/* — third-party webhooks (Stripe, etc.) MUST NOT
     *    be intercepted; they have no session cookie and would be
     *    redirected to /login (HTTP 307), which the sender treats as
     *    delivery failure.
     */
    "/((?!api/webhooks/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
