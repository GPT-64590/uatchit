import type { NextAuthConfig } from "next-auth";

export default {
  providers: [],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
  },
  callbacks: {
    // We do route gating manually in middleware.ts. Returning true here
    // means Auth.js does NOT short-circuit redirect to /login.
    authorized: async () => true,
  },
} satisfies NextAuthConfig;
