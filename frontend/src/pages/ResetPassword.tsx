import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

function ResetPassword() {
  // Reads the token straight out of the URL -- e.g. for
  // /reset-password/abc123, useParams gives us { token: "abc123" }.
  // Same technique PublicProfile.tsx uses for :userId.
  const { token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    // Check the two fields match BEFORE bothering the backend at all --
    // no point making a network request for something we can already
    // tell is wrong on the frontend.
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/api/auth/reset-password", {
        token,
        newPassword,
      });
      setMessage(response.data.message);

      // Give the user a moment to actually read the success message
      // before redirecting them to log in with their new password.
      setTimeout(() => navigate("/login"), 2000);
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
      <h1>Reset Password</h1>

      {message ? (
        // Once successful, hide the form entirely -- no point letting
        // someone resubmit a token that's already been used and cleared.
        <p>{message} Redirecting to login...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit">Reset Password</button>
        </form>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <p style={{ marginTop: "16px" }}>
        <Link to="/login">← Back to Login</Link>
      </p>
    </div>
  );
}

export default ResetPassword;