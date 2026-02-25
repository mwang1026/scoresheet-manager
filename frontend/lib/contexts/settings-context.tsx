"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { getDefaultSettings } from "@/lib/settings-types";
import type { UserSettings } from "@/lib/settings-types";

const STORAGE_KEY = "scoresheet-settings";

type Page = keyof Omit<UserSettings, "version">;

interface SettingsContextValue {
  settings: UserSettings;
  updatePageSettings: (page: Page, updates: Partial<UserSettings[Page]>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: getDefaultSettings(),
  updatePageSettings: () => {},
  resetSettings: () => {},
});

export function useSettingsContext(): SettingsContextValue {
  return useContext(SettingsContext);
}

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return getDefaultSettings();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultSettings();
    const parsed = JSON.parse(stored) as UserSettings;
    if (parsed.version !== 1) return getDefaultSettings();
    return parsed;
  } catch {
    return getDefaultSettings();
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());

  const updatePageSettings = useCallback(
    (page: Page, updates: Partial<UserSettings[Page]>) => {
      setSettings((prev) => {
        const next: UserSettings = {
          ...prev,
          [page]: { ...prev[page], ...updates },
        };
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    []
  );

  const resetSettings = useCallback(() => {
    const defaults = getDefaultSettings();
    setSettings(defaults);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updatePageSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
