import Stripe from "stripe";

// Single server-side Stripe client. Guards against missing env vars so
// the app can still build/run in preview without crashing — any actual
// Stripe call returns an error, but read-only pages render the seeded
// Phase 5 data without touching the network.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeNotConfiguredError();
  }
  cached = new Stripe(key, {
    // The Stripe SDK version pins an API version string. We intentionally
    // omit the pin here and let the SDK default apply, keeping us
    // compatible with whatever version the installed package targets.
    typescript: true,
  });
  return cached;
}

export function stripeIsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is not set. Configure it in the Vercel env vars.");
    this.name = "StripeNotConfiguredError";
  }
}
