import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { Resend as ResendClient } from "resend";
import { render } from "@react-email/components";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import MagicLinkEmail from "@/emails/magic-link";
import authConfig from "./auth.config";
import { generateCode, hashCode, CODE_TTL_MS } from "@/lib/otp";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  CSRF_COOKIE_NAME,
  CSRF_COOKIE_OPTIONS,
} from "@/lib/auth-cookie";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM!,
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const resend = new ResendClient(provider.apiKey as string);
        const host = new URL(url).host;
        // Issue a 6-digit panel code as a SEPARATE token row alongside the
        // strong magic-link token Auth.js already created. Email carries both;
        // redeeming either signs in (verify-otp clears the siblings).
        const code = generateCode();
        await db
          .insert(verificationTokens)
          .values({ identifier: email, token: hashCode(code), expires: new Date(Date.now() + CODE_TTL_MS) })
          .onConflictDoNothing();
        const html = await render(MagicLinkEmail({ url, host, code }));
        const { error } = await resend.emails.send({
          from: provider.from as string,
          to: email,
          subject: "Sign in to uatchit",
          html,
          text: `Sign in to uatchit\n\nYour code: ${code}\n(enter it in the uatchit side panel — expires in 15 minutes)\n\nOr open this link:\n${url}\n\n`,
        });
        if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  cookies: {
    sessionToken: { name: SESSION_COOKIE_NAME, options: SESSION_COOKIE_OPTIONS },
    // csrf must travel on the extension's cross-origin sign-in POST too.
    csrfToken: { name: CSRF_COOKIE_NAME, options: CSRF_COOKIE_OPTIONS },
  },
});
