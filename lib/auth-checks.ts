import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { type UserRole } from "@/db/schema/users";

export type AuthResult = 
  | { authorized: true; session: any; user: any }
  | { authorized: false; response: NextResponse };

/**
 * Require the user to be authenticated.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) 
    };
  }
  return { authorized: true, session, user: session.user };
}

/**
 * Require the user to have one of the specified roles.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) 
    };
  }

  const userRole = session.user.role as UserRole;
  if (!allowedRoles.includes(userRole)) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: "Forbidden: Insufficient Permissions" }, { status: 403 }) 
    };
  }

  return { authorized: true, session, user: session.user };
}

/**
 * Require the user to match a specific ID OR have one of the specified roles.
 */
export async function requireUserOrRole(userId: string, allowedRoles: UserRole[]): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) 
    };
  }

  const userRole = session.user.role as UserRole;
  const currentUserId = session.user.id;

  if (currentUserId !== userId && !allowedRoles.includes(userRole)) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 }) 
    };
  }

  return { authorized: true, session, user: session.user };
}
