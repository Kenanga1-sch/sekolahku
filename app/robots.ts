import { MetadataRoute } from 'next'

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/login', '/api/'],
    },
    sitemap: [
      'https://sdn1kenanga.sch.id/sitemap.xml',
      // Sitemap berita dinamis, digenerate backend dari database.
      'https://sdn1kenanga.sch.id/sitemap-news.xml',
    ],
  }
}
