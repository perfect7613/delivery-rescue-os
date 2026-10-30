import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function Setup() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>The desk is waiting on .env</CardTitle>
        <CardDescription>
          Copy .env.example to .env. Paste your Bolna and Sarvam keys there. DATABASE_URL is filled for the Supabase
          project when the worker role is created.
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  )
}
