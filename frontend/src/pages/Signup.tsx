import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

function Signup() {
  // Track what the user types in each field
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Shows an error message if signup fails
  const [error, setError] = useState("");

  // Lets us redirect the user to another page after signup succeeds
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stops the page from reloading on form submit

    setError(""); // clear any previous error before trying again

    try {
      // Calls the exact backend route we already built and tested in Postman
      await axios.post("http://localhost:5000/api/auth/signup", {
        name,
        email,
        password,
      });

      // On success, send the user to the login page
      navigate("/login");
    } catch (err: any) {
      // Show the backend's actual error message if there is one
      // (e.g. "An account with this email already exists.")
      const message = err.response?.data?.error || "Something went wrong. Please try again.";
      setError(message);
    }
  }

  return (
    <div style={{ maxWidth: "400px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Sign Up</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          <label>Name</label>
          <br />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

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

        {/* Only shows up if there's actually an error to display */}
        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit" style={{ padding: "8px 16px" }}>
          Sign Up
        </button>
      </form>

      <p style={{ marginTop: "16px" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

export default Signup;