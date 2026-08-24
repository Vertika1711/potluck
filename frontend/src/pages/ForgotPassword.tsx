import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetLink(null);

    try {
      const response = await axios.post("http://localhost:5000/api/auth/forgot-password", { email });
      setMessage(response.data.message);
      // DEV-ONLY -- resetLink only exists in the response because
      // there's no real email service wired up yet. In production this
      // field wouldn't be here at all, and the user would check their
      // inbox instead of seeing a link directly on screen.
      if (response.data.resetLink) {
        setResetLink(response.data.resetLink);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Something went wrong.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  return (
    <div style={{ maxWidth: "400px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Forgot Password</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Send Reset Link</button>
      </form>

      {message && <p>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* DEV-ONLY: shows the link directly since there's no real email
          sending yet -- see decisions-log.md for why this is deliberate. */}
      {resetLink && (
        <div style={{ marginTop: "16px", padding: "10px", border: "1px dashed gray" }}>
          <p><strong>Dev mode:</strong> since email sending isn't set up yet, here's your reset link directly:</p>
          <Link to={resetLink.replace("http://localhost:5173", "")}>{resetLink}</Link>
        </div>
      )}

      <p style={{ marginTop: "16px" }}>
        <Link to="/login">← Back to Login</Link>
      </p>
    </div>
  );
}

export default ForgotPassword;