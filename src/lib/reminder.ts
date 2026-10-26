import { isTauri } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const REMINDER_KEY = "ceres.reminder.lastShown";

export async function sendDailyReminder(language = "zh-CN"): Promise<void> {
  const today = new Date().toDateString();
  if (localStorage.getItem(REMINDER_KEY) === today) return;

  const granted = await ensureNotificationPermission();
  if (!granted) {
    localStorage.setItem(REMINDER_KEY, today);
    return;
  }

  if (isTauri()) {
    sendNotification({
      title:
        language === "zh-CN" ? "Ceres · 今日记录" : "Ceres · Daily record",
      body:
        language === "zh-CN"
          ? "今天还没有记录体重，花 10 秒记一笔吧。"
          : "You haven't logged your weight today. Take 10 seconds to note it.",
    });
  } else if (typeof Notification !== "undefined") {
    new Notification(language === "zh-CN" ? "Ceres · 今日记录" : "Ceres · Daily record", {
      body:
        language === "zh-CN"
          ? "今天还没有记录体重，花 10 秒记一笔吧。"
          : "You haven't logged your weight today. Take 10 seconds to note it.",
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
