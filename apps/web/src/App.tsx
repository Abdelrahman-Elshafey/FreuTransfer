import { useEffect, useState } from "react";

type Health = { status: string; core: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "3rem auto" }}>
      <h1>Swiss Transfer — Cost Comparer</h1>
      <p>What actually arrives when you send money between Switzerland and Europe.</p>
      <p>
        API status:{" "}
        {error ? `unreachable (${error})` : health ? `${health.status} (core ${health.core})` : "…"}
      </p>
    </main>
  );
}
