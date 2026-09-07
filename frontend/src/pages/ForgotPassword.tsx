import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
      setMessage(response.data.message);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Something went wrong.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  return (
    // Same full-bleed pattern as Home.tsx/Signup.tsx/Login.tsx (decisions-log.md #27).
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen flex flex-col bg-[#efe0c0] font-sans">

      {/* Exact same header as Signup.tsx/Login.tsx -- py-2, 30x30 icon,
          gap-0.2 -- kept identical across every auth page. */}
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

      {/* NEW: py-4 -> py-6 sm:py-8. Forgot Password has far less content
          than Signup/Login (one field instead of two or three), so there's
          real headroom to give the card more presence without risking a
          scrollbar the way Signup's tighter values were needed to avoid. */}
      <div className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8">
        {/* NEW: p-5/6 -> p-6/8, same translucent bg-white/60 + rounded-lg as
            Signup/Login (deliberately NOT switched to a solid background or
            bigger radius, to keep all three auth pages visually matching). */}
        <div className="w-full max-w-sm sm:max-w-md bg-white/60 backdrop-blur-sm rounded-lg p-6 sm:p-8">
          <h1
            className="text-center mb-2"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              color: "#4a7c59",
              fontSize: "clamp(1.6rem, 5vw, 2.1rem)",
            }}
          >
            Forgot Password
          </h1>

          {/* NEW: marginBottom set via inline style, not a Tailwind mb-*
              class. index.css has an unlayered `p { margin: 0; }` rule
              (decisions-log.md #26/#29) that silently overrides ANY
              Tailwind margin utility on a <p> regardless of the value --
              this is why mb-7 and mb-10 both had zero visible effect.
              Inline styles always win over stylesheet rules, so this is
              the only reliable way to actually apply this spacing. */}
          <p
            className="text-center text-xs sm:text-sm text-[#4a3620] leading-relaxed"
            style={{ marginBottom: "40px" }}
          >
            Enter your email and we'll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col">
            <div>
              <label className="block mb-1 font-semibold text-[#4a3620]">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-6 py-2.5 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              Send Reset Link
            </button>
          </form>

          {/* Success message -- uses the site's green accent, same family
              as the "About"/"How It Works" headings, rather than a generic
              gray, so it visually reads as a positive confirmation. Now the
              ONLY feedback shown on success -- since a real email is sent
              via Resend, there's no reset link to show directly anymore
              (see decisions-log.md #22's dev-mode note, now closed out). */}
          {message && (
            <p className="mt-4 text-sm text-[#4a7c59] bg-[#eef4ee] border border-[#a9c9b0] rounded px-3 py-2">
              {message}
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">
              {error}
            </p>
          )}

        <p className="text-center mt-5 text-[#4a3620]">
          Remembered your password?{" "}
          <Link to="/login" className="font-semibold text-[#8b5a2b] hover:underline">
            Log in
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;