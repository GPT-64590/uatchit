import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_TRUST_HOST: z.string().optional(),
  AUTH_RESEND_KEY: z.string().startsWith("re_"),
  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_FROM: z.string().min(3),
  AIMLAPI_KEY: z.string().min(20),
  LLM_BASE_URL: z.string().url().default("https://api.aimlapi.com/v1"),
  LLM_MODEL: z.string().default("google/gemini-3-1-flash-lite"),
  LLM_CHAT_MODEL: z.string().default("google/gemini-3-1-pro-preview"),
  BRIGHTDATA_API_KEY: z.string().min(20),
  BRIGHTDATA_ZONE_UNLOCKER: z.string().default("mcp_unlocker"),
  BRIGHTDATA_ZONE_BROWSER: z.string().default("mcp_browser"),
  // Optional pre-built scraper dataset IDs. When set, URLs matching the
  // corresponding pattern bypass Gemini inference entirely and use BD's
  // canonical schema for that platform. Find these in the BD control panel:
  // https://brightdata.com/cp/scrapers/browse
  BRIGHTDATA_DATASET_LINKEDIN_PROFILE: z.string().optional(),
  BRIGHTDATA_DATASET_LINKEDIN_COMPANY: z.string().optional(),
  BRIGHTDATA_DATASET_LINKEDIN_JOB: z.string().optional(),
  BRIGHTDATA_DATASET_AMAZON_PRODUCT: z.string().optional(),
  BRIGHTDATA_DATASET_CRUNCHBASE_COMPANY: z.string().optional(),
  BRIGHTDATA_DATASET_YAHOO_FINANCE: z.string().optional(),
  BRIGHTDATA_DATASET_X_POST: z.string().optional(),
  BRIGHTDATA_DATASET_YOUTUBE_VIDEO: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_MARKETING_URL: z.string().url().default("http://localhost:3000"),
  CRON_SECRET: z.string().min(32),
});

export const env = schema.parse(process.env);
