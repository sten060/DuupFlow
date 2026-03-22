import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/api/", "/onboarding/"],
      },
    ],
    sitemap: "https://duupflow.com/sitemap.xml",
  };
}
