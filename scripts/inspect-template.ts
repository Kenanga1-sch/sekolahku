
import { db } from "@/db";
import { letterTemplates } from "@/db/schema/letters";
import { eq } from "drizzle-orm";

async function main() {
  const id = "h4qv8lpter9o6jqu3l6vytsf";
  console.log(`Inspecting template: ${id}`);

  const [template] = await db
    .select()
    .from(letterTemplates)
    .where(eq(letterTemplates.id, id));

  if (!template) {
    console.log("Template NOT FOUND.");
    return;
  }

  console.log("Template Found:");
  console.log("Type:", template.type);
  console.log("FilePath:", template.filePath);
  console.log("Content (Raw):", template.content);
  
  try {
     const parsed = JSON.parse(template.content || "[]");
     console.log("Content (Parsed JSON):", parsed);
     console.log("Is Array?", Array.isArray(parsed));
  } catch (e) {
     console.log("Content is NOT valid JSON.");
  }
}

main().catch(console.error).finally(() => process.exit(0));
