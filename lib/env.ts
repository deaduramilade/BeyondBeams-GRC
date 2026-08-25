import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters."),
  AUTH_URL: z.string().url(),
  EMAIL_PROVIDER: z.enum(["preview", "resend"]).default("preview"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  NOTIFICATION_CRON_SECRET: z.string().min(32).optional(),
  RATE_LIMIT_SECRET: z.string().min(32).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (!env.DATABASE_URL.startsWith("postgres")) throw new Error("DATABASE_URL must use PostgreSQL in production.");
    if (!env.AUTH_URL.startsWith("https://")) throw new Error("AUTH_URL must use HTTPS in production.");
    if (env.EMAIL_PROVIDER === "preview") throw new Error("EMAIL_PROVIDER=preview is not allowed in production.");
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("RESEND_API_KEY and EMAIL_FROM are required in production.");
    if (!env.NOTIFICATION_CRON_SECRET) throw new Error("NOTIFICATION_CRON_SECRET is required in production.");
    if (!env.RATE_LIMIT_SECRET) throw new Error("RATE_LIMIT_SECRET is required in production.");
    if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) throw new Error("Cloudflare Turnstile keys are required in production.");
  }
  return env;
}

export function isProduction(input: NodeJS.ProcessEnv = process.env) { return input.NODE_ENV === "production"; }