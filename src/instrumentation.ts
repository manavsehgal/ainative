export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  return require("./instrumentation-node").registerNodeInstrumentation();
}
