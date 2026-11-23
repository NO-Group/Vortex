/**
 * Dynamic Grid Map + ambient mesh glows — the Layered Obsidian Canvas.
 * Sits fixed behind every page; glass panels catch these gradients.
 */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-mesh animate-glow-breathe" />
      <div className="absolute inset-0 bg-grid-map" />
      {/* data ripples — slow rings suggesting traffic pulses */}
      <div className="ripple left-[12%] top-[18%] h-64 w-64" style={{ animationDelay: '0s' }} />
      <div className="ripple left-[72%] top-[58%] h-80 w-80" style={{ animationDelay: '2.4s' }} />
      <div className="ripple left-[44%] top-[80%] h-48 w-48" style={{ animationDelay: '4.8s' }} />
    </div>
  );
}
