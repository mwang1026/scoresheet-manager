"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { getDefaultSettings } from "@/lib/settings-types";
import type { UserSettings } from "@/lib/settings-types";
import { fetchUserSettings, saveUserSettings } from "@/lib/api";

const STORAGE_KEY = "scoresheet-settings";
const SAVE_DEBOUNCE_MS = 1000;

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

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(getDefaultSettings);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettingsRef = useRef<UserSettings | null>(null);

  // Load stored settings from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as UserSettings;
      if (parsed.version === 1) {
        setSettings(parsed);
      }
    } catch {
      // Ignore parse errors, keep defaults
    }
  }, []);

  // On mount: async load from API, overwrite localStorage if valid
  useEffect(() => {
    fetchUserSettings()
      .then((apiSettings) => {
        if (apiSettings && apiSettings.version === 1) {
          setSettings(apiSettings);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(apiSettings));
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to load settings from API, using localStorage:", err);
      });
  }, []);

  // On unmount: flush any pending debounced save immediately
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        const toSave = pendingSettingsRef.current;
        pendingSettingsRef.current = null;
        if (toSave) {
          saveUserSettings(toSave).catch((err) => {
            console.warn("Failed to flush settings to API on unmount:", err);
          });
        }
      }
    };
  }, []);

  const scheduleSave = useCallback((nextSettings: UserSettings) => {
    pendingSettingsRef.current = nextSettings;
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const toSave = pendingSettingsRef.current;
      pendingSettingsRef.current = null;
      if (toSave) {
        saveUserSettings(toSave).catch((err) => {
          console.warn("Failed to save settings to API:", err);
        });
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

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
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const resetSettings = useCallback(() => {
    const defaults = getDefaultSettings();
    setSettings(defaults);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    // Cancel pending debounced save and immediately persist defaults
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSettingsRef.current = null;
    saveUserSettings(defaults).catch((err) => {
      console.warn("Failed to reset settings in API:", err);
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updatePageSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
