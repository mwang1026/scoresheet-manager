import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export async function checkEmailAllowed(email: string): Promise<boolean> {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
  const apiKey = process.env.INTERNAL_API_KEY || "";

  try {
    const res = await fetch(`${backendUrl}/api/auth/check-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-Internal-API-Key": apiKey } : {}),
      },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.allowed === true;
  } catch {
    return false;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      const allowed = await checkEmailAllowed(email);
      return allowed;
    },
    jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    session({ session, token }) {
      if (token.email && session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
});
