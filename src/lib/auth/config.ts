import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { getSupabaseServiceRole } from "@/lib/supabase/client";
import bcrypt from 'bcryptjs';
// Use bcryptjs for password hashing/comparison

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      platform_role: 'admin' | 'user';
      needsProfileCompletion: boolean;
    };
  }
}

const authConfig = {
  session: {
    strategy: "jwt" as const,
    // Keep users signed in unless they sign out (long-lived cookie)
    maxAge: 365 * 24 * 60 * 60, // 365 days
    updateAge: 24 * 60 * 60, // refresh cookie age every 24h on activity
  },
  jwt: {
    maxAge: 365 * 24 * 60 * 60, // align JWT age with session
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").trim().toLowerCase();
        const password = credentials?.password || "";
        if (!email || !password) return null;
        const { data: user } = await getSupabaseServiceRole()
          .from("users")
          .select("user_id, username, password_hash, email, platform_role")
          .eq("email", email)
          .maybeSingle();
        if (user && (user as any).password_hash) {
          const match = await bcrypt.compare(String(password), String((user as any).password_hash));
          if (match) {
            return {
              id: (user as any).user_id,
              name: (user as any).username,
              email: (user as any).email,
              platform_role: (user as any).platform_role || 'user',
            };
          }
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }: { token: any; user?: any; trigger?: string }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.platform_role = user.platform_role || 'user';
        token.needsProfileCompletion = user.needsProfileCompletion || false;
      }

      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      session.user = {
        id: String(token.id || ""),
        name: String(token.name || ""),
        email: String(token.email || ""),
        platform_role: token.platform_role || 'user',
        needsProfileCompletion: token.needsProfileCompletion || false,
      };
      return session;
    },
    async signIn({ user, account, profile }: any) {
      // Allow credentials login
      if (account?.provider === "credentials") {
        return true;
      }

      // Handle Google OAuth
      if (account?.provider === "google" && profile?.email) {
        const supabase = getSupabaseServiceRole();

        // Check if user exists with this email
        const { data: existingUser } = await supabase
          .from("users")
          .select("user_id, username, email, password_hash, platform_role")
          .eq("email", profile.email)
          .maybeSingle();

        if (existingUser) {
          // User exists, update user object for JWT
          user.id = (existingUser as any).user_id;
          user.name = (existingUser as any).username;
          user.email = (existingUser as any).email;
          user.platform_role = (existingUser as any).platform_role || 'user';
          user.needsProfileCompletion = !(existingUser as any).password_hash;
          return true;
        } else {
          // New user - create account
          const username = profile.email.split('@')[0].toLowerCase();
          const { data: newUser, error } = await supabase
            .from("users")
            .insert({
              username: username,
              email: profile.email,
              password_hash: '', // Empty for OAuth users - needs completion
              platform_role: 'user',
              is_active: true,
            })
            .select("user_id, username, email, platform_role")
            .single();

          if (error || !newUser) {
            console.error("Error creating OAuth user:", error);
            return false;
          }

          user.id = (newUser as any).user_id;
          user.name = (newUser as any).username;
          user.email = (newUser as any).email;
          user.platform_role = (newUser as any).platform_role || 'user';
          user.needsProfileCompletion = true;
          return true;
        }
      }

      return false;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
};

const { auth, signIn, signOut } = NextAuth(authConfig);

export { auth, signIn, signOut };

// Export options for getServerSession consumers (API routes, etc.)
export const authOptions = authConfig as any;