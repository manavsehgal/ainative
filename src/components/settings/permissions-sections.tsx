"use client";

import { useCallback, useRef } from "react";
import { PresetsSection } from "./presets-section";
import { PermissionsSection } from "./permissions-section";

/**
 * Wrapper that coordinates presets and individual permissions.
 * When a preset is toggled, the individual permissions list refreshes.
 */
export function PermissionsSections() {
  const permissionsRef = useRef<{ refresh: () => void }>(null);

  const handlePresetChange = useCallback(() => {
    permissionsRef.current?.refresh();
  }, []);

  return (
    <>
      <PresetsSection onPresetChange={handlePresetChange} />
      <PermissionsSection ref={permissionsRef} />
    </>
  );
}
