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
            
            // Forward authentication request to Golang backend
            const response = await fetch("http://localhost:8080/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                console.log("Auth Debug: Golang API returned error status", response.status);
                return null;
            }

            const data = await response.json();
            
            if (data.success && data.user) {
                console.log("Auth Debug: Login successful via Golang API", email);
                return data.user;
            }
            
            console.log("Auth Debug: Login failed via Golang API", email);
            return null;
        } catch (e) {
            console.error("Auth Debug Error:", e);
            return null;
        }
      }
    })
  ],
  secret: process.env.AUTH_SECRET,
});
