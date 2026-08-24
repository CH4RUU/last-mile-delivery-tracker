import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../api/client";
import { Role } from "../types";

const QUICK_LOGINS: { role: Role; label: string; email: string }[] = [
  { role: "ADMIN", label: "Admin", email: "admin@tracker.dev" },
  { role: "AGENT", label: "Agent", email: "agent.north@tracker.dev" },
  { role: "CUSTOMER", label: "Customer", email: "customer@tracker.dev" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("customer@tracker.dev");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function doLogin(loginEmail: string, loginPassword: string, busyKey: string) {
    setError("");
    setLoading(busyKey);
    try {
      const user = await login(loginEmail, loginPassword);
      if (user.role === "ADMIN") navigate("/admin");
      else if (user.role === "AGENT") navigate("/agent");
      else navigate("/orders");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    doLogin(email, password, "form");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="subtitle">Sign in to Last-Mile Delivery Tracker</p>

        <div className="text-sm muted" style={{ marginBottom: 8 }}>
          Quick login (seeded demo accounts)
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {QUICK_LOGINS.map((q) => (
            <button
              key={q.role}
              type="button"
              className="btn btn-outline btn-sm"
              style={{ flex: 1 }}
              disabled={loading !== null}
              onClick={() => doLogin(q.email, "password123", q.role)}
            >
              {loading === q.role ? "..." : q.label}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn" type="submit" style={{ width: "100%", marginTop: 6 }} disabled={loading !== null}>
            {loading === "form" ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-sm muted" style={{ marginTop: 16 }}>
          New customer? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
