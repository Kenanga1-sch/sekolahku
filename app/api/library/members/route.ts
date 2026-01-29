import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLibraryMembers, createLibraryMember } from "@/lib/library";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const session = await auth();
    
    // Auth check
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "20");
    const search = searchParams.get("search") || undefined;
    
    try {
        const result = await getLibraryMembers(page, perPage, { search });
        return NextResponse.json(result);
    } catch (error) {
        console.error("Fetch members error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await auth();
    
    // Auth check
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        
        // Validate with Zod
        const parseResult = await import("@/lib/validations/library").then(m => m.createMemberSchema.safeParseAsync(body));
        
        if (!parseResult.success) {
            return NextResponse.json({ 
                error: "Validation Error", 
                details: parseResult.error.flatten().fieldErrors 
            }, { status: 400 });
        }

        const member = await createLibraryMember(parseResult.data);
        return NextResponse.json(member);
    } catch (error) {
        console.error("Create member error:", error);
        return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
    }
}
