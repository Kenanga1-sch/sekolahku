/**
 * homepage — Client-side data fetcher for Public Homepage
 */

import { goGet } from "@/lib/api-client";

export async function getHomepageData() {
  return await goGet("/api/public/homepage");
}
