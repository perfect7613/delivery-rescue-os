import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
let child
let stopping = false

const start = () => {
  child = spawn("npm", ["run", "dev:worker"], { cwd: root, stdio: "inherit" })
  child.on("exit", (code, signal) => {
    if (stopping) return
    console.error(`[always-on] worker left the desk (code=${code ?? "none"} signal=${signal ?? "none"}). Resuming in 1s.`)
    setTimeout(start, 1000)
  })
}

const stop = (signal) => {
  stopping = true
  child?.kill(signal)
  process.exit(0)
}

process.on("SIGINT", () => stop("SIGINT"))
process.on("SIGTERM", () => stop("SIGTERM"))

console.error("[always-on] resident rescue worker. Closing the dashboard does not stop this process.")
start()
