import type { NextConfig } from "next"
import { loadEnvFile } from "node:process"
import { resolve } from "node:path"

try {
  loadEnvFile(resolve(process.cwd(), "../../.env"))
} catch {
  // The desk renders a setup state until .env exists.
}

const nextConfig: NextConfig = {
  transpilePackages: ["@rescue/shared", "@rescue/domain", "@rescue/connectors", "@rescue/harness"],
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
}

export default nextConfig
