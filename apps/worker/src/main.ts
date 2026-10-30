import { loadEnvFile } from "node:process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Layer } from "effect"
import { WorkerLive } from "@rescue/harness"

try {
  loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"))
} catch {
  // The resident supervisor still starts. Missing keys surface in the log.
}

Effect.runPromise(Layer.launch(WorkerLive))
