import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

function Signup() {
  // Track what the user types in each field
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
    // Same "full-bleed breakout" pattern as Home.tsx (decisions-log.md #27) --
    // escapes the app's centered #root column so the cream background can
    // span the full browser width. min-h-screen + flex-col so the footer-less
    // header sits at the top and the card centers in the remaining space,
    // however tall the viewport is.
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen flex flex-col bg-[#efe0c0] font-sans">

      {/* Simplified header -- just the wordmark and a way back to the
          landing page. No Home/About/Flow/Explore/Log In/Sign Up nav here,
          since none of those make sense mid-signup. Padding steps down on
          small screens like Home's header does. */}
      <header className="sticky top-0 z-50 bg-[#f7ecd8] border-b border-[#c9a06c] px-4 sm:px-8 py-2 flex justify-between items-center">
        <Link
          to="/"
          className="text-2xl sm:text-3xl text-[#4a3620]"
          style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
        >
          Potluck
        </Link>
        {/* NEW: icon-over-label instead of a text link. A plain inline SVG
            house icon (no icon library dependency), with "Home" beneath it
            in small text -- a common compact nav-button pattern. */}
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

      {/* Centers the form card both ways. NEW: vertical padding reduced
          (py-4 instead of py-10/16) so the whole card fits inside one
          laptop-height viewport without needing to scroll. */}
      <div className="flex-1 flex items-center justify-center px-4 py-4">
        {/* Card width steps up with the screen instead of a fixed px value --
            full width (minus the outer px-4) on mobile, capped at a
            comfortable reading width from sm and up. Same translucent white
            card + rounded corners used by Home's About/Flow sections.
            NEW: padding and gaps tightened (p-5/p-6 instead of p-6/p-8,
            gap-3 instead of gap-4) to shrink the card's total height. */}
        <div className="w-full max-w-sm sm:max-w-md bg-white/60 backdrop-blur-sm rounded-lg p-5 sm:p-6">
          {/* NEW: mb-3 instead of mb-4 -- pulls the heading (and everything
              below it) up slightly, freeing up room to give the password
              field and the button more breathing space instead. */}
          <h1
            className="text-center mb-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              color: "#4a7c59",
              fontSize: "clamp(1.5rem, 5vw, 2rem)",
            }}
          >
            Sign Up
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* NEW: the three fields now sit in their own gap-2 group
                (tighter than before), separate from the button below --
                this is what actually creates visible extra space between
                Password and the Sign Up button, rather than every element
                being evenly spaced by one uniform gap. */}
            <div className="flex flex-col gap-2">
              <div>
                <label className="block mb-1 font-semibold text-[#4a3620]">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b]"
                />
              </div>

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
                <p className="mt-1 text-xs text-[#7a6a58]">
                  At least 8 characters, with a letter, a number, and a special character.
                </p>
              </div>
            </div>

            {/* Only shows up if there's actually an error to display.
                Wrapped in a soft red box instead of bare red text, so it's
                still clearly legible against the cream card background. */}
            {error && (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">
                {error}
              </p>
            )}

            {/* NEW: mt-5 gives this button clearly more space above it than
                the fields have between each other, per the requested
                Password-to-button gap. */}
            <button
              type="submit"
              className="w-full mt-5 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              Sign Up
            </button>
          </form>

          <p className="text-center mt-4 text-[#4a3620]">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-[#8b5a2b] hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;