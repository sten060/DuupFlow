import { MetadataRoute } from "next";
import { UTM_REDIRECT_DISALLOW } from "@/lib/utm-redirects";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/admin/",
          "/api/",
          "/onboarding/",
          // UTM short URLs — auto-syncs from src/lib/utm-redirects.ts so
          // adding a new channel there propagates here without manual edits.
          ...UTM_REDIRECT_DISALLOW,
        ],
      },
    ],
    sitemap: "https://www.duupflow.com/sitemap.xml",
  };
}
