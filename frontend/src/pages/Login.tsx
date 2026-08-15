import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const response = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password,
      });

      // The backend sends back { token, user } on success.
      // We save the token in the browser's localStorage so it persists
      // even if the user closes the tab or refreshes the page.
      localStorage.setItem("token", response.data.token);

      // Send the user to their profile page after logging in
      navigate("/profile");
    } catch (err: any) {
      const message = err.response?.data?.error || "Something went wrong. Please try again.";
      setError(message);
    }
  }

  return (
    <div style={{ maxWidth: "400px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Log In</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label>Password</label>
          <br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit" style={{ padding: "8px 16px" }}>
          Log In
        </button>
      </form>

      <p style={{ marginTop: "16px" }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}

export default Login;