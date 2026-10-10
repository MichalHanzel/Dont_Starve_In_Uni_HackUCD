// Backend for the meal planner.
//   POST /api/suggest-meals           -> asks OpenRouter to fill empty planner slots
//   POST /api/create-checkout-session -> starts a Stripe TEST-mode checkout
//
// Run it with:  node server.js
// Secrets live in .env (never prefix them with VITE_, which would ship them
// to the browser).

import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import { parseAssignments, prepareJob } from "./meal-ai.js";

const {
  OPENROUTER_API_KEY: rawOpenRouterKey,
  OPENROUTER_MODEL = "openai/gpt-4o-mini",
  STRIPE_SECRET_KEY: rawStripeKey,
  CLIENT_URL = "http://localhost:5173",
  // Deliberately not called PORT, so it can't clash with a PORT already in .env
  API_PORT = 3001,
} = process.env;

// Stray spaces around a pasted key are a classic cause of "invalid key" errors
const OPENROUTER_API_KEY = rawOpenRouterKey?.trim();
const STRIPE_SECRET_KEY = rawStripeKey?.trim();

// Spots the usual key mistakes before we bother calling the service.
// Returns a short description of the problem, or null if the key looks fine.
function keyProblem(value, prefix, expected) {
  if (!value) return "is not set";
  if (value.includes("...")) {
    return "is still the placeholder text from the instructions. Paste your real key";
  }
  if (/\s/.test(value)) return "contains a space or line break. Remove it";
  if (/_live_/.test(value)) {
    return "is a live-mode key. This app only accepts test keys";
  }
  if (!prefix.test(value)) return `doesn't look right. It should start with ${expected}`;
  return null;
}

const openRouterProblem = keyProblem(OPENROUTER_API_KEY, /^sk-or-/, "sk-or-");
const stripeProblem = keyProblem(STRIPE_SECRET_KEY, /^(sk|rk)_test_/, "sk_test_");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));

// Both routes cost money or credits, so keep a lid on how often they're hit.
app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Try again in a minute." },
  })
);

// Open /api/health in the browser to check the proxy works and the keys loaded.
// It only reports yes/no, never the keys themselves.
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    openrouterKeyLoaded: !openRouterProblem,
    openrouterKeyProblem: openRouterProblem,
    stripeTestKeyLoaded: !stripeProblem,
    stripeKeyProblem: stripeProblem,
  });
});

// ---------- OpenRouter: meal suggestions ----------

app.post("/api/suggest-meals", async (req, res) => {
  if (openRouterProblem) {
    return res
      .status(500)
      .json({ error: `OPENROUTER_API_KEY ${openRouterProblem}, then restart the server.` });
  }

  let job;
  try {
    job = prepareJob(req.body);
  } catch (error) {
    return res.status(error.status ?? 400).json({ error: error.message });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // Optional headers OpenRouter uses to attribute traffic to your app
        "HTTP-Referer": CLIENT_URL,
        "X-Title": "Dont Starve in Uni",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: job.messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error(`OpenRouter returned ${response.status}: ${detail}`);
      const reasons = {
        401: "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in .env and restart the server.",
        402: "Your OpenRouter account is out of credits.",
        429: "OpenRouter is rate limiting this request. Wait a moment and try again.",
      };
      return res.status(502).json({
        error:
          reasons[response.status] ??
          `The AI service returned an error (${response.status}). Check the server log.`,
      });
    }

    const completion = await response.json();
    const content = completion?.choices?.[0]?.message?.content;
    const { assignments, note } = parseAssignments(content, job);

    if (assignments.length === 0) {
      return res
        .status(502)
        .json({ error: "The AI didn't return any usable suggestions. Try again." });
    }

    return res.json({ assignments, note });
  } catch (error) {
    console.error("Meal suggestion failed:", error.message);
    return res.status(502).json({ error: "Couldn't get suggestions right now. Try again." });
  }
});

// ---------- Stripe: test-mode subscription ----------

const stripe = stripeProblem ? null : new Stripe(STRIPE_SECRET_KEY);

// Refuse to run with a live key, so this can never take real money.
const isTestKey = !stripeProblem;

app.post("/api/create-checkout-session", async (req, res) => {
  if (!stripe || !isTestKey) {
    return res.status(500).json({
      error: `STRIPE_SECRET_KEY ${stripeProblem ?? "is missing"}, then restart the server.`,
    });
  }

  const userId = typeof req.body?.userId === "string" ? req.body.userId : "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: 499, // €4.99, in cents
            recurring: { interval: "month" },
            product_data: { name: "Don't Starve in Uni Premium (test)" },
          },
        },
      ],
      // Lets you match a payment to a user later, e.g. in a webhook
      client_reference_id: /^[\w-]{1,200}$/.test(userId) ? userId : undefined,
      success_url: `${CLIENT_URL}/?checkout=success`,
      cancel_url: `${CLIENT_URL}/?checkout=cancelled`,
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout failed:", error.message);
    const rejected = error.type === "StripeAuthenticationError";
    return res.status(502).json({
      error: rejected
        ? "Stripe rejected the key. Copy the test-mode secret key (sk_test_...) from the Stripe dashboard into STRIPE_SECRET_KEY, then restart the server."
        : "Couldn't start checkout. Check the server log.",
    });
  }
});

const server = app.listen(API_PORT, () => {
  console.log(`API listening on http://localhost:${API_PORT}`);
  if (openRouterProblem) console.warn(`Warning: OPENROUTER_API_KEY ${openRouterProblem}.`);
  if (stripeProblem) console.warn(`Warning: STRIPE_SECRET_KEY ${stripeProblem}.`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${API_PORT} is already in use. Stop whatever is using it, or set API_PORT in .env and match the proxy target in vite.config.js.`
    );
  } else {
    console.error("Server failed to start:", error.message);
  }
  process.exit(1);
});