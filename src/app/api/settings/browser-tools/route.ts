import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { SETTINGS_KEYS } from "@/lib/constants/settings";

export async function GET() {
  const [chromeEnabled, playwrightEnabled, chromeConfig, playwrightConfig] =
    await Promise.all([
      getSetting(SETTINGS_KEYS.BROWSER_MCP_CHROME_DEVTOOLS_ENABLED),
      getSetting(SETTINGS_KEYS.BROWSER_MCP_PLAYWRIGHT_ENABLED),
      getSetting(SETTINGS_KEYS.BROWSER_MCP_CHROME_DEVTOOLS_CONFIG),
      getSetting(SETTINGS_KEYS.BROWSER_MCP_PLAYWRIGHT_CONFIG),
    ]);

  return NextResponse.json({
    chromeDevtoolsEnabled: chromeEnabled === "true",
    playwrightEnabled: playwrightEnabled === "true",
    chromeDevtoolsConfig: chromeConfig ?? "",
    playwrightConfig: playwrightConfig ?? "",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.chromeDevtoolsEnabled !== undefined) {
    await setSetting(
      SETTINGS_KEYS.BROWSER_MCP_CHROME_DEVTOOLS_ENABLED,
      body.chromeDevtoolsEnabled ? "true" : "false"
    );
  }

  if (body.playwrightEnabled !== undefined) {
    await setSetting(
      SETTINGS_KEYS.BROWSER_MCP_PLAYWRIGHT_ENABLED,
      body.playwrightEnabled ? "true" : "false"
    );
  }

  if (body.chromeDevtoolsConfig !== undefined) {
    await setSetting(
      SETTINGS_KEYS.BROWSER_MCP_CHROME_DEVTOOLS_CONFIG,
      body.chromeDevtoolsConfig
    );
  }

  if (body.playwrightConfig !== undefined) {
    await setSetting(
      SETTINGS_KEYS.BROWSER_MCP_PLAYWRIGHT_CONFIG,
      body.playwrightConfig
    );
  }

  // Return updated state
  const [chromeEnabled, playwrightEnabled, chromeConfig, playwrightConfig] =
    await Promise.all([
      getSetting(SETTINGS_KEYS.BROWSER_MCP_CHROME_DEVTOOLS_ENABLED),
      getSetting(SETTINGS_KEYS.BROWSER_MCP_PLAYWRIGHT_ENABLED),
      getSetting(SETTINGS_KEYS.BROWSER_MCP_CHROME_DEVTOOLS_CONFIG),
      getSetting(SETTINGS_KEYS.BROWSER_MCP_PLAYWRIGHT_CONFIG),
    ]);

  return NextResponse.json({
    chromeDevtoolsEnabled: chromeEnabled === "true",
    playwrightEnabled: playwrightEnabled === "true",
    chromeDevtoolsConfig: chromeConfig ?? "",
    playwrightConfig: playwrightConfig ?? "",
  });
}
