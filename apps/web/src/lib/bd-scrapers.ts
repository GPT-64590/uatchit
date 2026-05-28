import "server-only";
import { env } from "./env";
import type { InferredSchema, InferredField } from "./infer-schema";

/**
 * Build a deterministic two-line mutationThesis from the BD route's canonical
 * fields. Mirrors the universal-prompt LLM output shape so the sidepanel
 * SchemaPreviewCard renders it identically.
 */
function bdScraperThesis(routeName: string, fieldNames: string[]): string {
  const watching = fieldNames.slice(0, 6).join(", ") || "the structured fields below";
  return `watching: ${watching}.\nskipping: page chrome, navigation, and identity fields — bright data ${routeName.replace(/_/g, " ")} returns only the canonical mutable fields.`;
}

/**
 * Bright Data has a library of ~660 pre-built site scrapers. For known URL
 * patterns we route directly to the matching dataset instead of paying Gemini
 * to infer a schema — the BD scraper returns clean structured JSON and we
 * know the field set in advance.
 *
 * Each route is keyed to an optional env var holding the dataset id (found
 * via the BD control panel). If the env var is unset, the route is silently
 * disabled — callers fall back to the generic Gemini path.
 */

interface BDRoute {
  name: string;
  matches: (u: URL) => boolean;
  datasetIdEnv: keyof typeof env;
  pageType: InferredSchema["pageType"];
  // Canonical field definitions (snake_case names + types).
  fields: InferredField[];
  /** Map BD's response row → our extracted shape (must match `fields` names). */
  pluck: (row: Record<string, unknown>) => Record<string, unknown>;
}

function f(name: string, type: InferredField["type"], description: string): InferredField {
  return { name, type, description, locator: `bd_scraper.${name}`, sampleValue: null };
}

function strOrNull(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const ROUTES: BDRoute[] = [
  {
    name: "linkedin_profile",
    datasetIdEnv: "BRIGHTDATA_DATASET_LINKEDIN_PROFILE",
    matches: (u) => /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/in\//.test(u.pathname),
    pageType: "other",
    fields: [
      f("name", "string", "person name"),
      f("headline", "string", "headline"),
      f("location", "string", "location"),
      f("current_company", "string", "current company"),
      f("connections", "number", "connection count"),
      f("followers", "number", "follower count"),
    ],
    pluck: (r) => ({
      name: strOrNull(r.name ?? r.full_name),
      headline: strOrNull(r.headline ?? r.position),
      location: strOrNull(r.location ?? r.city),
      current_company: strOrNull(r.current_company ?? r.company),
      connections: numOrNull(r.connections ?? r.num_connections),
      followers: numOrNull(r.followers ?? r.num_followers),
    }),
  },
  {
    name: "linkedin_company",
    datasetIdEnv: "BRIGHTDATA_DATASET_LINKEDIN_COMPANY",
    matches: (u) => /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/company\//.test(u.pathname),
    pageType: "other",
    fields: [
      f("name", "string", "company name"),
      f("industry", "string", "industry"),
      f("headquarters", "string", "HQ location"),
      f("employees", "number", "employee count"),
      f("followers", "number", "follower count"),
      f("about", "string", "about / description"),
    ],
    pluck: (r) => ({
      name: strOrNull(r.name ?? r.company_name),
      industry: strOrNull(r.industry),
      headquarters: strOrNull(r.headquarters ?? r.hq),
      employees: numOrNull(r.employees ?? r.company_size),
      followers: numOrNull(r.followers ?? r.num_followers),
      about: strOrNull(r.about ?? r.description),
    }),
  },
  {
    name: "linkedin_job",
    datasetIdEnv: "BRIGHTDATA_DATASET_LINKEDIN_JOB",
    matches: (u) => /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/jobs\/(view\/\d+|search)/.test(u.pathname),
    pageType: "job_listing",
    fields: [
      f("job_title", "string", "job title"),
      f("company", "string", "company"),
      f("location", "string", "location"),
      f("salary_range", "string", "salary range"),
      f("applicants", "number", "applicant count"),
      f("posted_at", "string", "posted date"),
      f("employment_type", "string", "employment type"),
    ],
    pluck: (r) => ({
      job_title: strOrNull(r.job_title ?? r.title),
      company: strOrNull(r.company_name ?? r.company),
      location: strOrNull(r.job_location ?? r.location),
      salary_range: strOrNull(r.base_salary ?? r.salary),
      applicants: numOrNull(r.job_num_applicants ?? r.applicants),
      posted_at: strOrNull(r.job_posted_time ?? r.posted_at),
      employment_type: strOrNull(r.job_employment_type ?? r.employment_type),
    }),
  },
  {
    name: "amazon_product",
    datasetIdEnv: "BRIGHTDATA_DATASET_AMAZON_PRODUCT",
    matches: (u) => /amazon\./i.test(u.hostname) && /\/(dp|gp\/product)\//.test(u.pathname),
    pageType: "product",
    fields: [
      f("title", "string", "product title"),
      f("brand", "string", "brand"),
      f("price", "number", "current price"),
      f("currency", "string", "currency"),
      f("rating", "number", "average rating"),
      f("review_count", "number", "review count"),
      f("availability", "string", "stock status"),
    ],
    pluck: (r) => ({
      title: strOrNull(r.title ?? r.name),
      brand: strOrNull(r.brand),
      price: numOrNull(r.price ?? r.final_price),
      currency: strOrNull(r.currency),
      rating: numOrNull(r.rating ?? r.average_rating),
      review_count: numOrNull(r.reviews_count ?? r.review_count),
      availability: strOrNull(r.availability),
    }),
  },
  {
    name: "crunchbase_company",
    datasetIdEnv: "BRIGHTDATA_DATASET_CRUNCHBASE_COMPANY",
    matches: (u) => /(^|\.)crunchbase\.com$/.test(u.hostname) && /^\/organization\//.test(u.pathname),
    pageType: "other",
    fields: [
      f("name", "string", "company name"),
      f("about", "string", "company description"),
      f("headquarters", "string", "HQ"),
      f("founded", "string", "founded year"),
      f("employee_range", "string", "employee range"),
      f("total_funding", "number", "total funding (USD)"),
      f("last_funding_round", "string", "last funding round"),
    ],
    pluck: (r) => ({
      name: strOrNull(r.name),
      about: strOrNull(r.about ?? r.description),
      headquarters: strOrNull(r.headquarters_regions ?? r.headquarters),
      founded: strOrNull(r.founded_date ?? r.founded),
      employee_range: strOrNull(r.num_employees_enum ?? r.employee_count),
      total_funding: numOrNull(r.total_funding_usd ?? r.total_funding),
      last_funding_round: strOrNull(r.last_funding_type ?? r.last_funding_round),
    }),
  },
  {
    name: "yahoo_finance",
    datasetIdEnv: "BRIGHTDATA_DATASET_YAHOO_FINANCE",
    matches: (u) => /(^|\.)finance\.yahoo\.com$/.test(u.hostname),
    pageType: "other",
    fields: [
      f("symbol", "string", "ticker symbol"),
      f("name", "string", "company name"),
      f("price", "number", "current price"),
      f("change", "number", "price change"),
      f("change_pct", "number", "price change %"),
      f("market_cap", "string", "market cap"),
      f("sector", "string", "sector"),
    ],
    pluck: (r) => ({
      symbol: strOrNull(r.symbol ?? r.ticker),
      name: strOrNull(r.name ?? r.company_name),
      price: numOrNull(r.price ?? r.regular_market_price),
      change: numOrNull(r.change ?? r.regular_market_change),
      change_pct: numOrNull(r.change_percent ?? r.regular_market_change_percent),
      market_cap: strOrNull(r.market_cap),
      sector: strOrNull(r.sector),
    }),
  },
  {
    name: "x_post",
    datasetIdEnv: "BRIGHTDATA_DATASET_X_POST",
    matches: (u) => /(^|\.)(x|twitter)\.com$/.test(u.hostname) && /\/status\/\d+/.test(u.pathname),
    pageType: "other",
    fields: [
      f("author", "string", "post author handle"),
      f("text", "string", "post text"),
      f("likes", "number", "likes"),
      f("retweets", "number", "retweets"),
      f("replies", "number", "replies"),
      f("views", "number", "views"),
      f("posted_at", "string", "posted timestamp"),
    ],
    pluck: (r) => ({
      author: strOrNull(r.username ?? r.author_handle),
      text: strOrNull(r.text ?? r.content),
      likes: numOrNull(r.likes ?? r.like_count),
      retweets: numOrNull(r.retweets ?? r.retweet_count),
      replies: numOrNull(r.replies ?? r.reply_count),
      views: numOrNull(r.views ?? r.view_count),
      posted_at: strOrNull(r.created_at ?? r.posted_at),
    }),
  },
  {
    name: "youtube_video",
    datasetIdEnv: "BRIGHTDATA_DATASET_YOUTUBE_VIDEO",
    matches: (u) => /(^|\.)youtube\.com$/.test(u.hostname) && /^\/watch$/.test(u.pathname),
    pageType: "other",
    fields: [
      f("title", "string", "video title"),
      f("channel", "string", "channel name"),
      f("views", "number", "view count"),
      f("likes", "number", "like count"),
      f("comments", "number", "comment count"),
      f("published_at", "string", "publish date"),
    ],
    pluck: (r) => ({
      title: strOrNull(r.title),
      channel: strOrNull(r.channel_name ?? r.channel),
      views: numOrNull(r.views ?? r.view_count),
      likes: numOrNull(r.likes ?? r.like_count),
      comments: numOrNull(r.comments ?? r.comment_count),
      published_at: strOrNull(r.upload_date ?? r.published_at),
    }),
  },
];

export interface BDScraperResult {
  routeName: string;
  schema: InferredSchema;
  extracted: Record<string, unknown>;
  /** JSON-serialised structured response — used as snapshot.contentMarkdown so future ticks can diff. */
  contentMarkdown: string;
}

export function findBDRoute(url: string): BDRoute | null {
  try {
    const u = new URL(url);
    return ROUTES.find((r) => r.matches(u) && !!env[r.datasetIdEnv]) ?? null;
  } catch {
    return null;
  }
}

export async function tryBDScraper(url: string): Promise<
  | { ok: true; result: BDScraperResult }
  | { ok: false; reason: string; detail: string }
> {
  const route = findBDRoute(url);
  if (!route) return { ok: false, reason: "no_route", detail: "no matching BD scraper" };
  const datasetId = env[route.datasetIdEnv] as string | undefined;
  if (!datasetId) return { ok: false, reason: "no_dataset_id", detail: `${route.datasetIdEnv} not set` };

  const apiUrl = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${encodeURIComponent(datasetId)}&format=json`;
  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.BRIGHTDATA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ url }]),
    });
  } catch (e: unknown) {
    return { ok: false, reason: "network", detail: String((e as Error)?.message ?? e) };
  }

  if (!res.ok) {
    return { ok: false, reason: "bd_error", detail: `${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}` };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: "bd_bad_response", detail: "non-JSON response" };
  }

  // Sync: array of records. Async (auto-converted at 1min): { snapshot_id }.
  if (data && typeof data === "object" && !Array.isArray(data) && (data as Record<string, unknown>).snapshot_id) {
    // Bail — the user is waiting on a live chat call. Let the caller fall back.
    return { ok: false, reason: "bd_async_required", detail: "scraper took >1 minute; fall back to AI inference" };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, reason: "bd_no_rows", detail: "scraper returned no rows" };
  }

  const row = data[0] as Record<string, unknown>;
  const extracted = route.pluck(row);
  const contentMarkdown =
    `# ${route.name} via Bright Data\n\n` +
    Object.entries(extracted)
      .map(([k, v]) => `- ${k}: ${v === null || v === undefined ? "(null)" : JSON.stringify(v)}`)
      .join("\n");

  // Fill sample values for visualisation in the schema preview.
  const fieldsWithSamples: InferredField[] = route.fields.map((field) => {
    const v = extracted[field.name];
    let sample: InferredField["sampleValue"] = null;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      sample = v;
    }
    return { ...field, sampleValue: sample };
  });

  const title = strOrNull(extracted.title ?? extracted.name ?? extracted.headline ?? extracted.job_title) ?? `${route.name} on ${new URL(url).host}`;

  return {
    ok: true,
    result: {
      routeName: route.name,
      schema: {
        pageType: route.pageType,
        title,
        intent: `Track ${route.name.replace(/_/g, " ")} via Bright Data structured scraper.`,
        mutationThesis: bdScraperThesis(route.name, fieldsWithSamples.map((fld) => fld.name)),
        fields: fieldsWithSamples,
        confidence: 0.97,
      },
      extracted,
      contentMarkdown,
    },
  };
}
