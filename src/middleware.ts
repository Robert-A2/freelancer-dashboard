import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const setAll: SetAllCookies = (cookiesToSet) => {
    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
    supabaseResponse = NextResponse.next({ request });
    cookiesToSet.forEach(({ name, value, options }) =>
      supabaseResponse.cookies.set(name, value, options)
    );
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll,
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicPaths = ["/login", "/signup", "/reset-password", "/demo"];

  // Pages an already-authenticated user should be bounced away from.
  // "/reset-password" is deliberately NOT included here: exchanging the
  // recovery code signs the user in, but they still need to land on this
  // page to set their new password — redirecting them away at that point
  // would silently abort the password reset flow.
  const authOnlyPaths = ["/login", "/signup"];

  // "/" is the landing page — public for unauthenticated visitors,
  // but authenticated users should go straight to the dashboard.
  const isLanding = pathname === "/";
  const isPublic  = isLanding || publicPaths.some((p) => pathname.startsWith(p));
  const isAuthOnly = authOnlyPaths.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from auth pages AND the landing page
  if (user && (isLanding || isAuthOnly)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
