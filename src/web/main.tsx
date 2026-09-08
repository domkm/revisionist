import { Schema } from "effect";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Status } from "../shared/status.ts";

function App() {
  const [state, setState] = useState("Connecting…");
  useEffect(() => {
    const controller = new AbortController();
    async function connect() {
      try {
        const response = await fetch("/api/health", { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const status = Schema.decodeUnknownSync(Status)(await response.json());
        setState(`Connected · v${status.version}`);
      } catch {
        if (!controller.signal.aborted) setState("Unavailable");
      }
    }
    connect().catch(() => {
      if (!controller.signal.aborted) setState("Unavailable");
    });
    return () => controller.abort();
  }, []);
  return (
    <main>
      <p className="eyebrow">Local integration example</p>
      <h1>Revisionist</h1>
      <output>{state}</output>
      <p>This page verifies the development foundation. Markdown review comes next.</p>
    </main>
  );
}

const root = document.getElementById("root");
if (root === null) throw new Error("Missing root element");
createRoot(root).render(<App />);
