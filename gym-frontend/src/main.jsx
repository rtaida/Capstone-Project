const globalAuthFetch = window.fetch.bind(window);

const clearStoredSession = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("auth_token");
  localStorage.removeItem("token");
  localStorage.removeItem("authToken");
};

window.addEventListener("popstate", clearStoredSession, true);
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  clearStoredSession();
  window.location.replace("/login");
});

function decodeJwtPayload(token) {
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
}

function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  return Number(payload.exp) * 1000 <= Date.now();
}

function getMatchingAuthToken() {
  const user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
  const expectedRole = String(user.role || user.type || "").toLowerCase();
  const tokenKeys = ["auth_token", "token", "authToken"];

  const tokens = [
    ...tokenKeys.map((key) => localStorage.getItem(key)),
    ...tokenKeys.map((key) => sessionStorage.getItem(key)),
  ].filter((token, index, all) => token && all.indexOf(token) === index);

  const validTokens = tokens.filter((token) => !isTokenExpired(token));

  if (expectedRole) {
    const matchingToken = validTokens.find((token) => {
      const role = String(decodeJwtPayload(token)?.role || decodeJwtPayload(token)?.userRole || "").toLowerCase();
      return role === expectedRole;
    });
    if (matchingToken) return matchingToken;
  }

  if (!validTokens.length) {
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("authToken");
    return "";
  }

  const preferredAdminToken = validTokens.find((token) => {
    const role = String(decodeJwtPayload(token)?.role || decodeJwtPayload(token)?.userRole || "").toLowerCase();
    return role === "admin" || role === "staff";
  });

  return preferredAdminToken || validTokens[0];
}

window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  const token = getMatchingAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return globalAuthFetch(input, { ...init, headers });
};

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);