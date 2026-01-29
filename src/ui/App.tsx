import React, { useEffect, useMemo, useState } from "react";
import { api, setToken, getToken } from "../lib/api";
import { getDeviceFingerprint } from "../lib/fingerprint";
import "leaflet/dist/leaflet.css";
import { MapPreview } from "./MapPreview";

type Device = {
  deviceId: string;
  deviceName: string;
  model: string;
  osVersion: string;
  installDate: string;
  lastSeen?: string;
  status: "ACTIVE" | "OFFLINE" | "REINSTALLED";
  lastLocation?: { lat: number; lng: number; address?: string; timestamp?: string };
};

type LocationLog = {
  _id: string;
  deviceId: string;
  lat: number;
  lng: number;
  address?: string;
  timestamp: string;
  createdAt: string;
};

function formatDate(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function App() {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total: number; online: number; offline: number } | null>(null);
  const [q, setQ] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Device | null>(null);
  const [locationLogs, setLocationLogs] = useState<LocationLog[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationLog | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const authed = useMemo(() => Boolean(token), [token]);

  async function load() {
    const s = await api.summary();
    setSummary(s);
    const sinceIso = since ? new Date(since).toISOString() : undefined;
    const untilIso = until ? new Date(until).toISOString() : undefined;
    const { devices } = await api.listDevices(q, sinceIso, untilIso);
    setDevices(devices as any);
  }

  useEffect(() => {
    if (!authed) return;
    load().catch((e) => setError(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const t = setTimeout(() => load().catch(() => {}), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, since, until]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const fingerprint = await getDeviceFingerprint();
      const resp = await api.login({ email, password, fingerprint });
      setToken(resp.token);
      setTokenState(resp.token);
      setEmail("");
      setPassword("");
      await load();
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const resp = await api.changePassword({ oldPassword, newPassword });
      setToken(resp.token);
      setTokenState(resp.token);
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      setError(err.message || "Change password failed");
    }
  }

  function logout() {
    setToken(null);
    setTokenState(null);
    setDevices([]);
    setSelected(null);
    setLocationLogs([]);
    setSelectedLocation(null);
  }

  async function loadLocationLogs(deviceId: string) {
    setLoadingLogs(true);
    setSelectedLocation(null);
    try {
      const { logs } = await api.getLocationLogs(deviceId);
      setLocationLogs(logs);
      // Auto-select the most recent location for map display
      if (logs.length > 0) {
        setSelectedLocation(logs[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load location logs");
      setLocationLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    if (selected?.deviceId) {
      loadLocationLogs(selected.deviceId);
    } else {
      setLocationLogs([]);
      setSelectedLocation(null);
    }
  }, [selected?.deviceId]);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ margin: 0 }}>Device Theft Protection — Admin</h2>
      <div style={{ color: "#666", marginTop: 6, marginBottom: 16 }}>View-only dashboard</div>

      {error ? (
        <div style={{ padding: 10, border: "1px solid #f2c3c3", background: "#fff5f5", color: "#9b1c1c", borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {!authed ? (
        <form onSubmit={onLogin} style={{ maxWidth: 420, padding: 14, border: "1px solid #eee", borderRadius: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Secure Login</div>
          <label style={{ display: "block", marginBottom: 8 }}>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
          </label>
          <button type="submit" style={{ padding: "10px 12px", width: "100%" }}>
            Login
          </button>
          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            Note: first successful login device becomes trusted. Unknown devices are blocked automatically.
          </div>
        </form>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Total devices</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{summary?.total ?? "—"}</div>
              </div>
              <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Online</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{summary?.online ?? "—"}</div>
              </div>
              <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Offline</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{summary?.offline ?? "—"}</div>
              </div>
            </div>
            <button onClick={logout} style={{ padding: "10px 12px" }}>
              Logout
            </button>
          </div>

          <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Change Password</div>
            <form onSubmit={onChangePassword} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="password"
                placeholder="Old password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                style={{ padding: 10, flex: "1 1 220px" }}
              />
              <input
                type="password"
                placeholder="New password (min 10 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ padding: 10, flex: "1 1 260px" }}
              />
              <button type="submit" style={{ padding: "10px 12px" }}>
                Update
              </button>
            </form>
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              Password change invalidates all existing JWT sessions automatically.
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 600 }}>Devices</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by device name"
                  style={{ padding: 10, width: 260, maxWidth: "100%" }}
                />
                <input
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  style={{ padding: 10 }}
                  title="Since (by lastSeen)"
                />
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  style={{ padding: 10 }}
                  title="Until (by lastSeen)"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
              <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ maxHeight: 420, overflow: "auto" }}>
                  {devices.map((d) => (
                    <div
                      key={d.deviceId}
                      onClick={() => setSelected(d)}
                      style={{
                        padding: 12,
                        cursor: "pointer",
                        borderBottom: "1px solid #f3f3f3",
                        background: selected?.deviceId === d.deviceId ? "#f7fbff" : "white",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 600 }}>{d.deviceName}</div>
                        <div style={{ fontSize: 12, color: d.status === "ACTIVE" ? "#0a7" : d.status === "OFFLINE" ? "#b40" : "#777" }}>
                          {d.status}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Last seen: {formatDate(d.lastSeen)}</div>
                    </div>
                  ))}
                  {devices.length === 0 ? <div style={{ padding: 12, color: "#666" }}>No devices</div> : null}
                </div>
              </div>

              <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                {!selected ? (
                  <div style={{ color: "#666" }}>Select a device to view details.</div>
                ) : (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Device Details</div>
                    <div style={{ fontSize: 13, color: "#333", marginBottom: 12 }}>
                      <div>
                        <b>Device Name:</b> {selected.deviceName}
                      </div>
                      <div>
                        <b>Device ID:</b> {selected.deviceId}
                      </div>
                      <div>
                        <b>Model:</b> {selected.model}
                      </div>
                      <div>
                        <b>OS Version:</b> {selected.osVersion}
                      </div>
                      <div>
                        <b>Install Date:</b> {formatDate(selected.installDate)}
                      </div>
                      <div>
                        <b>Last Seen:</b> {formatDate(selected.lastSeen)}
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <MapPreview 
                        lat={selectedLocation?.lat || selected.lastLocation?.lat} 
                        lng={selectedLocation?.lng || selected.lastLocation?.lng}
                        timestamp={selectedLocation?.timestamp || selected.lastLocation?.timestamp}
                        address={selectedLocation?.address || selected.lastLocation?.address}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {selected && (
              <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Location History ({locationLogs.length} entries)</div>
                {loadingLogs ? (
                  <div style={{ padding: 12, color: "#666" }}>Loading location logs...</div>
                ) : locationLogs.length === 0 ? (
                  <div style={{ padding: 12, color: "#666" }}>No location logs found for this device.</div>
                ) : (
                  <div style={{ maxHeight: 400, overflow: "auto", border: "1px solid #eee", borderRadius: 8 }}>
                    {locationLogs.map((log) => (
                      <div
                        key={log._id}
                        onClick={() => setSelectedLocation(log)}
                        style={{
                          padding: 12,
                          cursor: "pointer",
                          borderBottom: "1px solid #f3f3f3",
                          background: selectedLocation?._id === log._id ? "#f7fbff" : "white",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (selectedLocation?._id !== log._id) {
                            e.currentTarget.style.background = "#f9f9f9";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedLocation?._id !== log._id) {
                            e.currentTarget.style.background = "white";
                          }
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                              {formatDate(log.timestamp)}
                            </div>
                            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                              {log.lat.toFixed(6)}, {log.lng.toFixed(6)}
                            </div>
                            {log.address && (
                              <div style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>{log.address}</div>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#999" }}>
                            {selectedLocation?._id === log._id ? "📍 Showing" : "Click to show"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


