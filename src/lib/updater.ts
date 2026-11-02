import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

export const FALLBACK_VERSION = "0.2.3";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "latest"
  | "available"
  | "downloading"
  | "installing"
  | "error";

export interface UpdaterState {
  status: UpdaterStatus;
  currentVersion?: string;
  version?: string;
  body?: string;
  progress?: number;
  message?: string;
}

export async function getAppVersion(): Promise<string> {
  if (!isTauri()) return FALLBACK_VERSION;
  try {
    return await getVersion();
  } catch {
    return FALLBACK_VERSION;
  }
}

export function useUpdater({
  autoCheck = true,
  checkDelay = 1400,
}: {
  autoCheck?: boolean;
  checkDelay?: number;
} = {}) {
  const [state, setState] = useState<UpdaterState>({ status: "idle" });
  const updateRef = useRef<Update | null>(null);

  useEffect(() => {
    let active = true;
    void getAppVersion().then((version) => {
      if (active) {
        setState((previous) => ({ ...previous, currentVersion: version }));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const checkNow = useCallback(async () => {
    if (!isTauri()) {
      setState((previous) => ({
        ...previous,
        status: "error",
        message: "unsupported",
      }));
      return;
    }
    setState((previous) => ({ ...previous, status: "checking" }));
    try {
      const update = await check({ timeout: 20000 });
      const currentVersion = await getAppVersion();
      if (!update) {
        updateRef.current?.close();
        updateRef.current = null;
        setState({ status: "latest", currentVersion });
        return;
      }
      updateRef.current = update;
      setState({
        status: "available",
        currentVersion,
        version: update.version,
        body: update.body ?? undefined,
      });
    } catch (caught) {
      setState((previous) => ({
        ...previous,
        status: "error",
        message: String(caught),
      }));
    }
  }, []);

  const install = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    const currentVersion =
      state.currentVersion ?? (await getAppVersion());
    setState({
      status: "downloading",
      currentVersion,
      version: update.version,
      body: update.body ?? undefined,
      progress: 0,
    });
    let downloaded = 0;
    let total = 0;
    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          setState((previous) => ({ ...previous, progress: 0 }));
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setState((previous) => ({
            ...previous,
            progress:
              total > 0
                ? Math.min(99, Math.round((downloaded / total) * 100))
                : 1,
          }));
        } else if (event.event === "Finished") {
          setState((previous) => ({ ...previous, status: "installing" }));
        }
      });
      setState((previous) => ({ ...previous, status: "installing" }));
    } catch (caught) {
      setState((previous) => ({
        ...previous,
        status: "error",
        message: String(caught),
      }));
    }
  }, [state.currentVersion]);

  useEffect(() => {
    if (!autoCheck) return;
    const timer = window.setTimeout(() => void checkNow(), checkDelay);
    return () => window.clearTimeout(timer);
  }, [autoCheck, checkDelay, checkNow]);

  return { state, checkNow, install };
}
