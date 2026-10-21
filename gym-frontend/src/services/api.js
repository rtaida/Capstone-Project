





const API_URL = import.meta.env.VITE_API_URL || "/api";
const AUTH_KEYS = ["auth_token", "token", "authToken"];

const readStoredValue = (storage, key) => {
  try {
    const value = storage.getItem(key);
    return value ? String(value).trim() : "";
  } catch {
    return "";
  }
};

const decodeJwtPayload = (token) => {
  try {
    const [, body] = String(token || "").split(".");
    if (!body) return null;
    const normalized = body.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    const payload = JSON.parse(atob(padded));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
};

const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  return Number(payload.exp) * 1000 <= Date.now();
};

export const readStoredAuthToken = () => {
  if (typeof window === "undefined") return "";

  const user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  const expectedRole = String(user.role || user.type || "").toLowerCase();
  const candidates = [
    ...AUTH_KEYS.map((key) => readStoredValue(localStorage, key)),
    ...AUTH_KEYS.map((key) => readStoredValue(sessionStorage, key)),
  ].filter((token, index, all) => token && all.indexOf(token) === index);

  const validCandidates = candidates.filter((token) => !isTokenExpired(token));
  const matchingRoleToken = validCandidates.find((token) => {
    const payload = decodeJwtPayload(token);
    const decodedRole = String(payload?.role || payload?.userRole || "").toLowerCase();
    return decodedRole && expectedRole && decodedRole === expectedRole;
  });

  if (matchingRoleToken) return matchingRoleToken;

  if (expectedRole && validCandidates.length) {
    const preferredByRole = validCandidates.find((token) => {
      const payload = decodeJwtPayload(token);
      const decodedRole = String(payload?.role || payload?.userRole || "").toLowerCase();
      return decodedRole === expectedRole || decodedRole === "admin" || decodedRole === "staff";
    });
    if (preferredByRole) return preferredByRole;
  }

  if (!validCandidates.length) {
    clearAuthToken();
    return "";
  }

  return validCandidates[0];
};

export const persistAuthToken = (token) => {
  if (typeof window === "undefined") return;

  const safeToken = (token || "").trim();

  [localStorage, sessionStorage].forEach((storage) => {
    AUTH_KEYS.forEach((key) => {
      if (safeToken) {
        storage.setItem(key, safeToken);
      } else {
        storage.removeItem(key);
      }
    });
  });
};

export const clearAuthToken = () => {
  if (typeof window === "undefined") return;

  [localStorage, sessionStorage].forEach((storage) => {
    AUTH_KEYS.forEach((key) => storage.removeItem(key));
  });
};

export const getAuthHeaders = () => {
  const token = readStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};









export const testDatabaseConnection = async () => {
  try {
    const response = await fetch(`${API_URL}/test_connection.php`);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: error.message,
      server_time: null,
    };
  }
};
















