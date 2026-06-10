import { AutoredLookupError } from "@/lib/autored-errors";

const MIN_INTERVAL_MS = Number(process.env.AUTORED_MIN_INTERVAL_MS ?? "3000");
const COOLDOWN_MS = Number(process.env.AUTORED_COOLDOWN_MS ?? "300000");

let lastRequestAt = 0;
let cooldownUntil = 0;
let chain: Promise<unknown> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getAutoredCooldownRemainingMs(): number {
  return Math.max(0, cooldownUntil - Date.now());
}

export function registerAutoredRateLimit(cooldownMs = COOLDOWN_MS): void {
  cooldownUntil = Date.now() + cooldownMs;
}

export function getAutoredMinIntervalMs(): number {
  return MIN_INTERVAL_MS;
}

export async function runAutoredQueued<T>(fn: () => Promise<T>): Promise<T> {
  const task = async (): Promise<T> => {
    const cooldownRemaining = getAutoredCooldownRemainingMs();
    if (cooldownRemaining > 0) {
      throw new AutoredLookupError(
        "RATE_LIMITED",
        `Autored limito las consultas. Espera ${Math.ceil(cooldownRemaining / 60_000)} minuto(s) e intenta de nuevo.`,
        429,
      );
    }

    const waitMs = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (waitMs > 0) await sleep(waitMs);
    lastRequestAt = Date.now();

    try {
      return await fn();
    } catch (error) {
      if (error instanceof AutoredLookupError && error.code === "RATE_LIMITED") {
        registerAutoredRateLimit();
      }
      throw error;
    }
  };

  const result = chain.then(task, task);
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
