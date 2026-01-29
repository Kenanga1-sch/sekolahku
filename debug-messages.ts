
import { db } from "./db";
import { contactMessages } from "./db/schema/misc";

async function checkMessages() {
  console.log("Checking contact messages...");
  const messages = await db.select().from(contactMessages);
  console.log("Total messages:", messages.length);
  console.log(JSON.stringify(messages, null, 2));
}

checkMessages()
  .catch((e) => console.error(e))
  .finally(() => process.exit(0));
