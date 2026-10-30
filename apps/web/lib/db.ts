import postgres from "postgres"

let client: postgres.Sql | null = null

export const databaseUrl = (): string | null => process.env.DATABASE_URL || null

export const db = (): postgres.Sql => {
  const url = databaseUrl()
  if (!url) throw new Error("DATABASE_URL is empty")
  client ??= postgres(url, { ssl: "require", max: 1, idle_timeout: 5, connect_timeout: 10 })
  return client
}
