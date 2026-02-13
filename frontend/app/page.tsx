import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-foreground">
          Scoresheet Manager
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fantasy baseball management tool — 10-team Scoresheet league.
        </p>

        <div className="mt-6">
          <table className="w-full">
            <thead className="sticky top-0 border-b bg-background">
              <tr className="text-sm text-muted-foreground">
                <th className="p-3 text-left">Player</th>
                <th className="p-3 text-right tabular-nums">AVG</th>
                <th className="p-3 text-right tabular-nums">HR</th>
                <th className="p-3 text-right tabular-nums">OPS</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="even:bg-muted/50 hover:bg-muted">
                <td className="p-3 font-medium">Bobby Witt Jr.</td>
                <td className="p-3 text-right tabular-nums">.332</td>
                <td className="p-3 text-right tabular-nums">32</td>
                <td className="p-3 text-right tabular-nums">.904</td>
              </tr>
              <tr className="even:bg-muted/50 hover:bg-muted">
                <td className="p-3 font-medium">Aaron Judge</td>
                <td className="p-3 text-right tabular-nums">.322</td>
                <td className="p-3 text-right tabular-nums">58</td>
                <td className="p-3 text-right tabular-nums">1.159</td>
              </tr>
              <tr className="even:bg-muted/50 hover:bg-muted">
                <td className="p-3 font-medium">Shohei Ohtani</td>
                <td className="p-3 text-right tabular-nums">.310</td>
                <td className="p-3 text-right tabular-nums">54</td>
                <td className="p-3 text-right tabular-nums">1.036</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-3">
          <Button>Get Started</Button>
          <Button variant="outline">View Docs</Button>
        </div>
      </div>
    </main>
  );
}
