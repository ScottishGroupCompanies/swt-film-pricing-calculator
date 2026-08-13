# Deploying the Pricing Calculator

## Option A — Vercel (quickest)

1. Scaffold a Vite React project:
```bash
npx create-vite@latest swt-pricing --template react
cd swt-pricing
npm install
```

2. Replace `src/App.jsx` with `../app/swt-pricing-calculator.jsx`

3. Add your Anthropic API key. In the component, find `generateInvoice()` and update the fetch headers:
```js
headers: {
  "Content-Type": "application/json",
  "x-api-key": "YOUR_ANTHROPIC_API_KEY",
  "anthropic-version": "2023-06-01"
}
```
> **Important:** For production, never expose the API key in the frontend. Use a serverless function (Vercel Edge Function or Next.js API route) to proxy the Anthropic call.

4. Run locally:
```bash
npm run dev
```

5. Deploy to Vercel:
```bash
npm install -g vercel
vercel
```

---

## Option B — Next.js with API Route (recommended for production)

This keeps the Anthropic API key server-side only.

1. Scaffold Next.js:
```bash
npx create-next-app@latest swt-pricing --no-tailwind --no-app-router
cd swt-pricing
npm install
```

2. Copy `swt-pricing-calculator.jsx` to `pages/index.jsx` (or `components/PricingCalc.jsx` and import it)

3. Create `pages/api/invoice.js`:
```js
export default async function handler(req, res) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(req.body)
  });
  const data = await response.json();
  res.json(data);
}
```

4. In `generateInvoice()` in the component, change the fetch URL from:
```js
"https://api.anthropic.com/v1/messages"
```
to:
```js
"/api/invoice"
```
And remove the API key from headers (the proxy handles it).

5. Add `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

6. Deploy:
```bash
vercel
# Set ANTHROPIC_API_KEY in Vercel project environment variables
```

---

## Option C — Run in Claude.ai Artifact (current state)

The app as-is works inside Claude.ai artifacts, which proxy the Anthropic API automatically — no key needed. This is how it was built and tested. For internal use only, this may be sufficient without deploying.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — get from console.anthropic.com |

---

## Updating After Deployment

When the pricing spreadsheet is updated (new films, revised group rates, new reps):

1. Open `swt-pricing-calculator.jsx`
2. Update the relevant data arrays (`FILMS`, `PRICING_GROUPS`, `DESIGNERS`)
3. Redeploy (`vercel --prod` or push to connected GitHub repo)

The docs in `/docs/` should be updated in parallel to stay in sync.
