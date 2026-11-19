// Stop hook: avisa si queda feina de codi sense desar i el pla sense tocar.
// El problema de la §11.62: una sessió que plega sense commitejar ni marcar res.
import { execSync } from "node:child_process";

try {
  const out = execSync("git status --porcelain", { encoding: "utf8" });
  const files = out.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  const codi = files.filter((f) => /^(web|api|scripts)\//.test(f));
  const pla = files.filter((f) => f.startsWith("docs/pla-poliment/"));

  if (codi.length > 0) {
    const avis = [
      `Queden ${codi.length} fitxers de codi sense desar: ${codi.slice(0, 5).join(", ")}${codi.length > 5 ? "…" : ""}.`,
      pla.length === 0
        ? "I el pla de poliment no s'ha tocat: ningú ha marcat què s'ha fet."
        : "El pla sí que s'ha tocat.",
      "Abans de plegar: crida l'agent `bitacola` perquè marqui la fase i commiteji.",
    ].join(" ");
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "Stop", additionalContext: avis },
      })
    );
  }
} catch {
  // Sense git o fora del repositori: no diguis res.
}
