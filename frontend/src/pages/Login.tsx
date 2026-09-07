import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // NEW: controls whether the password field shows plain text or dots.
  // A custom toggle (rather than relying on the browser's native reveal
  // icon) so it can actually be styled in the app's brown, consistently
  // across every browser -- see the Signup.tsx conversation for why.
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
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
    // Same full-bleed pattern as Home.tsx/Signup.tsx (decisions-log.md #27).
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen flex flex-col bg-[#efe0c0] font-sans">

      {/* Same simplified header as Signup.tsx -- wordmark, and an
          icon-over-label Home link. Kept as its own compact gap-0.5 so the
          header height stays the same as Signup's, even though the icon
          and label are visually larger than a plain text link would be. */}
      <header className="sticky top-0 z-50 bg-[#f7ecd8] border-b border-[#c9a06c] px-4 sm:px-8 py-2 flex justify-between items-center">
        <Link
          to="/"
          className="text-2xl sm:text-3xl text-[#4a3620]"
          style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
        >
          Potluck
        </Link>
        <Link
          to="/"
          className="flex flex-col items-center gap-0.2 text-[#4a3620] hover:text-[#8b5a2b]"
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 11L12 3L21 11" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 10V20H19V10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-base font-semibold">Home</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-4">
        <div className="w-full max-w-sm sm:max-w-md bg-white/60 backdrop-blur-sm rounded-lg p-5 sm:p-6">
          <h1
            className="text-center mb-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              color: "#4a7c59",
              fontSize: "clamp(1.5rem, 5vw, 2rem)",
            }}
          >
            Log In
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="flex flex-col gap-2">
              <div>
                <label className="block mb-1 font-semibold text-[#4a3620]">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[#4a3620]">Password</label>
                {/* relative wrapper lets the toggle button sit inside the
                    input's right edge; pr-10 on the input keeps typed text
                    from ever running under the button. */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 pr-10 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b5a2b]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {/* Plain inline SVG eye / eye-off icons, matching the
                        stroke style already used for the Home icon and
                        Home.tsx's hamburger toggle -- no icon library or
                        emoji, and colors exactly with currentColor. */}
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3L21 21" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10.6 10.6C10.2 10.9 10 11.4 10 12C10 13.1 10.9 14 12 14C12.6 14 13.1 13.7 13.4 13.4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M6.5 6.7C4 8.3 2 12 2 12C2 12 5.5 19 12 19C14 19 15.7 18.4 17.1 17.5M9.5 5.2C10.3 5.1 11.1 5 12 5C18.5 5 22 12 22 12C22 12 21.2 13.6 19.7 15.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full mt-5 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              Log In
            </button>
          </form>

          <p className="text-center mt-4 text-[#4a3620]">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-[#8b5a2b] hover:underline">
              Sign up
            </Link>
          </p>

          <p className="text-center mt-1 text-[#4a3620]">
            <Link to="/forgot-password" className="font-semibold text-[#8b5a2b] hover:underline">
              Forgot your password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;