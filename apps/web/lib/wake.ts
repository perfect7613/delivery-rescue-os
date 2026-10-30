import { processFor } from "@rescue/harness"
import { Effect } from "effect"
import { after } from "next/server"

/** Keep working the queue after the HTTP response, for this one invocation. */
export const wakeWorker = () => {
  after(() => Effect.runPromise(processFor(20_000)))
}
