import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});


export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        try {
            const { email, password } = await loginSchema.parseAsync(credentials);
            
            // Allow searching in Drizzle
            const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
            if (!user) {
                console.log("Auth Debug: User not found", email);
                return null;
            }

            if (!user.passwordHash) {
                console.log("Auth Debug: User has no password hash", email);
                return null;
            }
    
            const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
            if (passwordsMatch) {
                console.log("Auth Debug: Password match success", email);
                return user;
            }
            
            console.log("Auth Debug: Password mismatch", email);
            return null;
        } catch (e) {
            console.error("Auth Debug Error:", e);
            console.error("Auth Debug Error:", e);
            // Removed file logging to satisfy lint rules (no require) and security (no writing to fs in auth)
            return null;
        }
      }
    })
  ],
  secret: process.env.AUTH_SECRET,
});
