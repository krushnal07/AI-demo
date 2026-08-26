// src/components/AlertNotifier.js
// Polls our own backend (not an external broadcaster) for AnalyticsImage rows
// that landed in the DB since the last poll, and keeps them in a in-app
// notification store. See GET /api/Analytics/latest-alerts.
//
// Nothing is toasted anymore -- the header bell (see Header.js) reads this
// store via useAlerts() and renders a YouTube-style dropdown instead.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { hasPermission, rolePermissions } from "./Sidebar";

const POLL_INTERVAL_MS = 8000;
const MAX_ALERTS = 50;
const STORAGE_KEY = "alertNotifications";

const AlertContext = createContext({
  alerts: [],
  unreadCount: 0,
  markAllRead: () => {},
  removeAlert: () => {},
  clearAlerts: () => {},
});

export const useAlerts = () => useContext(AlertContext);

const loadStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ALERTS) : [];
  } catch {
    return [];
  }
};

export const AlertProvider = ({ children, enabled = true }) => {
  const [alerts, setAlerts] = useState(loadStored);
  const cursorRef = useRef(null);
  const initializedRef = useRef(false);

  // Keep the bell populated across reloads/route changes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.slice(0, MAX_ALERTS)));
    } catch {
      /* quota / private mode -- the in-memory list still works */
    }
  }, [alerts]);

  useEffect(() => {
    if (!enabled) return;

    const email = localStorage.getItem("email");
    if (!email) return;

    // These alerts are AI events, so they follow the sidebar's "AI Events"
    // permission -- but only skip polling when we're sure. Some login paths
    // (OTP) never store a role, and multi-role users store a comma-joined
    // string, neither of which resolves against rolePermissions. In those
    // cases let the server decide; it answers 403 and we stop then.
    const role = localStorage.getItem("role");
    if (role && rolePermissions[role] && !hasPermission(role, "AI Events")) return;

    let cancelled = false;
    let intervalId = null;
    const baseUrl = `${process.env.REACT_APP_BASE_URL}/api/Analytics/latest-alerts`;

    const poll = async () => {
      try {
        const url = cursorRef.current
          ? `${baseUrl}?email=${encodeURIComponent(email)}&afterId=${cursorRef.current}`
          : `${baseUrl}?email=${encodeURIComponent(email)}`;
        const res = await fetch(url);

        // Server says this role may not receive alerts -- stop rather than
        // retry every 8s for the rest of the session.
        if (res.status === 403) {
          cancelled = true;
          if (intervalId) clearInterval(intervalId);
          return;
        }

        if (!res.ok) {
          console.warn(`AlertNotifier: latest-alerts responded ${res.status}`);
          return;
        }

        const json = await res.json();
        if (cancelled || !json?.success) return;

        cursorRef.current = json.cursor || cursorRef.current;

        // First-ever poll only establishes the cursor baseline -- nothing new yet.
        if (!initializedRef.current) {
          initializedRef.current = true;
          return;
        }

        const incoming = json.data || [];
        if (!incoming.length) return;

        setAlerts((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          const fresh = incoming
            .filter((a) => !seen.has(a.id))
            .map((a) => ({ ...a, read: false, receivedAt: Date.now() }));
          if (!fresh.length) return prev;
          // Newest first, same as the YouTube bell.
          return [...fresh.reverse(), ...prev].slice(0, MAX_ALERTS);
        });
      } catch (err) {
        console.error("AlertNotifier poll failed:", err);
      }
    };

    poll();
    intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [enabled]);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => (prev.some((a) => !a.read) ? prev.map((a) => ({ ...a, read: true })) : prev));
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  const value = useMemo(
    () => ({
      alerts,
      unreadCount: alerts.reduce((n, a) => (a.read ? n : n + 1), 0),
      markAllRead,
      removeAlert,
      clearAlerts,
    }),
    [alerts, markAllRead, removeAlert, clearAlerts]
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
};

export default AlertProvider;
