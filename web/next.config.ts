import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sparticuz/chromium ships its Chromium binary as large brotli-compressed
  // files (chromium.br, swiftshader.tar.br, etc.) that are only referenced
  // dynamically at runtime via chromium.executablePath() — Next's static
  // file-tracing analysis can't see that reference, so on Vercel these
  // files get excluded from the serverless function bundle entirely,
  // leaving "/var/task/web/node_modules/@sparticuz/chromium/bin does not
  // exist" at runtime. Explicitly including them here for every route that
  // calls htmlToPdf() (src/lib/pdf.ts) fixes that.
  outputFileTracingIncludes: {
    "/api/zoho/generate-estimate": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
