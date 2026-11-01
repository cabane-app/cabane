import type { AuthData } from "home-assistant-js-websocket";

export const HOME_ASSISTANT_TOKEN_STORAGE_KEY = "cabane:ha-auth:v1";
export const HOME_ASSISTANT_URL_STORAGE_KEY = "cabane:ha-url:v1";
export const LEGACY_HOME_ASSISTANT_TOKEN_STORAGE_KEY = "smart-home-3d:ha-auth:v1";
export const LEGACY_HOME_ASSISTANT_URL_STORAGE_KEY = "smart-home-3d:ha-url:v1";

export const normalizeHomeAssistantUrl = (value: string | null | undefined) => {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
};

/** HTTP is supported only for development with both endpoints on this machine. */
export const homeAssistantTransportError = (
  dashboardUrl: string,
  homeAssistantUrl: string,
): string | null => {
  try {
    const dashboard = new URL(dashboardUrl);
    const ha = new URL(homeAssistantUrl);
    if (dashboard.protocol === "https:" && ha.protocol === "https:") return null;
    const loopback = (url: URL) =>
      url.hostname === "localhost" ||
      url.hostname === "[::1]" ||
      /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname);
    if (
      dashboard.protocol === "http:" &&
      ha.protocol === "http:" &&
      loopback(dashboard) &&
      loopback(ha)
    )
      return null;
  } catch {
    // Invalid and non-web addresses fail closed.
  }
  return "Open Cabane over HTTPS and use an HTTPS Home Assistant address. HTTP development requires both addresses to use localhost, 127.0.0.0/8, or [::1] on this machine.";
};

/** Native panels reuse the host socket, never a cross-origin OAuth connection. */
export const borrowedHomeAssistantTransportError = (
  dashboardUrl: string,
  hostUrl: string,
): string | null => {
  const pageOrigin = normalizeHomeAssistantUrl(dashboardUrl);
  const hostOrigin = normalizeHomeAssistantUrl(hostUrl);
  return pageOrigin && pageOrigin === hostOrigin
    ? null
    : "Open the native Cabane panel on the same HTTP or HTTPS origin as its Home Assistant host. Standalone connections require HTTPS.";
};

export const loadStoredHomeAssistantUrl = (
  storage: Pick<Storage, "getItem" | "removeItem"> & Partial<Pick<Storage, "setItem">>,
) => {
  try {
    const current = storage.getItem(HOME_ASSISTANT_URL_STORAGE_KEY);
    const stored = current ?? storage.getItem(LEGACY_HOME_ASSISTANT_URL_STORAGE_KEY);
    const normalized = normalizeHomeAssistantUrl(stored);
    if (current && !normalized) storage.removeItem(HOME_ASSISTANT_URL_STORAGE_KEY);
    if (current === null && normalized)
      storage.setItem?.(HOME_ASSISTANT_URL_STORAGE_KEY, normalized);
    return normalized;
  } catch {
    return null;
  }
};

export const saveStoredHomeAssistantUrl = (
  storage: Pick<Storage, "setItem" | "removeItem">,
  value: string | null,
) => {
  try {
    if (value) storage.setItem(HOME_ASSISTANT_URL_STORAGE_KEY, value);
    else storage.removeItem(HOME_ASSISTANT_URL_STORAGE_KEY);
  } catch {
    // The URL can remain session-only when persistent browser storage is blocked.
  }
};

export const hasAuthenticationCallback = (href: string) => {
  try {
    return new URL(href).searchParams.has("auth_callback");
  } catch {
    return false;
  }
};

export const cleanAuthenticationCallback = (
  href: string,
  history: Pick<History, "replaceState">,
) => {
  const url = new URL(href);
  if (!["auth_callback", "code", "state"].some((key) => url.searchParams.has(key))) {
    return false;
  }
  url.searchParams.delete("auth_callback");
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
};

const isAuthData = (value: unknown): value is AuthData => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthData>;
  return (
    typeof candidate.hassUrl === "string" &&
    (typeof candidate.clientId === "string" || candidate.clientId === null) &&
    typeof candidate.expires === "number" &&
    typeof candidate.refresh_token === "string" &&
    typeof candidate.access_token === "string" &&
    typeof candidate.expires_in === "number"
  );
};

export const homeAssistantAuthStorageKey = (homeAssistantUrl: string, clientId: string) => {
  const origin = normalizeHomeAssistantUrl(homeAssistantUrl);
  if (!origin || !clientId)
    throw new Error("A valid Home Assistant origin and client ID are required.");
  return `cabane:ha-auth:v2:${encodeURIComponent(origin)}:${encodeURIComponent(clientId)}`;
};

export const homeAssistantLogoutStorageKey = (homeAssistantUrl: string, clientId: string) =>
  `${homeAssistantAuthStorageKey(homeAssistantUrl, clientId)}:logout`;

// Read before loading credentials and on every write: storage events can arrive late.
export const readLogoutGeneration = (
  storage: Pick<Storage, "getItem">,
  homeAssistantUrl: string,
  clientId: string,
) => {
  try {
    return storage.getItem(homeAssistantLogoutStorageKey(homeAssistantUrl, clientId));
  } catch {
    return null;
  }
};

export const invalidateStoredAuthData = (
  storage: Storage,
  homeAssistantUrl: string,
  clientId: string,
) => {
  try {
    // getRandomValues works on HTTP dashboards too.
    const generation = Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
      value.toString(16),
    ).join("-");
    storage.setItem(homeAssistantLogoutStorageKey(homeAssistantUrl, clientId), generation);
  } catch {
    /* Local lifecycle guards still protect a storage-disabled page. */
  }
  saveStoredAuthData(storage, null, homeAssistantUrl, clientId);
};

export const loadStoredAuthData = (
  storage: Pick<Storage, "getItem" | "removeItem">,
  homeAssistantUrl: string,
  clientId: string,
): AuthData | null => {
  const key = homeAssistantAuthStorageKey(homeAssistantUrl, clientId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (
      !isAuthData(data) ||
      ("logoutGeneration" in data &&
        data.logoutGeneration !== readLogoutGeneration(storage, homeAssistantUrl, clientId)) ||
      normalizeHomeAssistantUrl(data.hassUrl) !== normalizeHomeAssistantUrl(homeAssistantUrl) ||
      data.clientId !== clientId
    ) {
      storage.removeItem(key);
      return null;
    }
    const { logoutGeneration: _generation, ...tokens } = data as AuthData & {
      logoutGeneration?: string | null;
    };
    return tokens;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      /* Storage may be unavailable. */
    }
    return null;
  }
};

export const saveStoredAuthData = (
  storage: Pick<Storage, "setItem" | "removeItem">,
  data: AuthData | null,
  homeAssistantUrl: string,
  clientId: string,
  logoutGeneration?: string | null,
) => {
  const key = homeAssistantAuthStorageKey(homeAssistantUrl, clientId);
  if (
    data &&
    (!isAuthData(data) ||
      normalizeHomeAssistantUrl(data.hassUrl) !== normalizeHomeAssistantUrl(homeAssistantUrl) ||
      data.clientId !== clientId)
  )
    return;
  try {
    if (data)
      storage.setItem(
        key,
        JSON.stringify(logoutGeneration === undefined ? data : { ...data, logoutGeneration }),
      );
    else storage.removeItem(key);
  } catch {
    // OAuth can still work for the current page when persistent browser storage is blocked.
  }
};
