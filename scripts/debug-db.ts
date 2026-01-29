
import { db } from "../db/index";
import { announcements } from "../db/schema/misc";
import { desc } from "drizzle-orm";

async function checkThumbnails() {
  const news = await db.select({
    id: announcements.id,
    title: announcements.title,
    thumbnail: announcements.thumbnail
  })
  .from(announcements)
  .orderBy(desc(announcements.createdAt))
  .limit(5);

  console.log("Recent Announcements Thumbnails:");
  console.log(JSON.stringify(news, null, 2));
}

checkThumbnails();
