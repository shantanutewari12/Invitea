import type { MetadataRoute } from "next";

/** Guest links and APIs must never be indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/i/", "/api/", "/dashboard", "/invites/", "/create"] }],
  };
}
