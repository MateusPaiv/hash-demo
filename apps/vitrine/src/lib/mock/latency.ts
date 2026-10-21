/** Simulated network latency so the UI exercises real loading states. */
export function delay(ms = 250 + Math.random() * 450): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
