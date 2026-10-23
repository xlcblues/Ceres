import { isTauri } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const REMINDER_KEY = "ceres.reminder.lastShown";

export async function sendDailyReminder(): Promise<void> {
  const today = new Date().toDateString();
  if (localStorage.getItem(REMINDER_KEY) === today) return;

  const granted = await ensureNotificationPermission();
  if (!granted) {
    localStorage.setItem(REMINDER_KEY, today);
    return;
  }

  if (isTauri()) {
    sendNotification({
      title: "Ceres · 今日记录",
      body: "今天还没有记录体重，花 10 秒记一笔吧。",
    });
  } else if (typeof Notification !== "undefined") {
    new Notification("Ceres · 今日记录", {
      body: "今天还没有记录体重，花 10 秒记一笔吧。",
    });
  }
  localStorage.setItem(REMINDER_KEY, today);
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (isTauri()) {
    try {
      if (await isPermissionGranted()) return true;
      return (await requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}
