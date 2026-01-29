import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { p5Grades } from "@/db/schema/curriculum";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
      const body = await req.json();
      const { projectId, grades } = body;
      // Grades = [{ studentId, dimension, predicate }]
      
      for (const g of grades) {
          // Check exist
          const exist = await db.select().from(p5Grades)
            .where(and(
                eq(p5Grades.projectId, projectId),
                eq(p5Grades.studentId, g.studentId),
                eq(p5Grades.dimension, g.dimension)
            )).limit(1);

          if (exist.length > 0) {
             await db.update(p5Grades).set({ predicate: g.predicate }).where(eq(p5Grades.id, exist[0].id));
          } else {
             await db.insert(p5Grades).values({
                 projectId,
                 studentId: g.studentId,
                 dimension: g.dimension,
                 predicate: g.predicate
             });
          }
      }
      
      return NextResponse.json({ success: true });
  } catch (error) {
     return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
