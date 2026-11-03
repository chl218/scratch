// Runs once when the server starts. Starts the activity digest timer (SPEC F7).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDigestTimer } = await import("./lib/digest");
    startDigestTimer();
  }
}
