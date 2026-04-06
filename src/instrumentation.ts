export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Single dynamic import with bundler-ignore so Turbopack's Edge analyzer
    // never follows this module's Node.js dependency tree.
    const { registerNode } = await import(
      /* webpackIgnore: true */ "./instrumentation.node"
    );
    await registerNode();
  }
}
