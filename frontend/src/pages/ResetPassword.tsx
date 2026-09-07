import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";

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

  // NEW: separate visibility toggles for each field, same pattern as
  // Login.tsx/Signup.tsx -- a real toggle button rather than the
  // browser's native (unstylable) reveal icon.
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const response = await axios.post(`${API_URL}/api/auth/reset-password`, {
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

  // Small reusable eye / eye-off icon set, identical to Login.tsx's, so
  // both password-toggle buttons on this page match every other
  // password field in the app.
  function EyeIcon({ visible }: { visible: boolean }) {
    return visible ? (
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
    );
  }

  return (
    // Same full-bleed pattern as Home.tsx/Signup.tsx/Login.tsx/ForgotPassword.tsx.
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen flex flex-col bg-[#efe0c0] font-sans">

      {/* Same sticky header used across every auth page. */}
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
        {/* Two fields + button is roughly the same amount of content as
            Login.tsx, so this uses Login's tighter p-5/6 sizing rather than
            Forgot Password's more generous spacing -- there isn't the same
            spare room here without risking a scrollbar. */}
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
            Reset Password
          </h1>

          {message ? (
            // Once successful, hide the form entirely -- no point letting
            // someone resubmit a token that's already been used and
            // cleared. Styled as the same green success box used on
            // Forgot Password, so a completed action reads consistently
            // across both pages.
            <p className="text-center text-sm text-[#4a7c59] bg-[#eef4ee] border border-[#a9c9b0] rounded px-3 py-2">
              {message} Redirecting to login...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col">
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block mb-1 font-semibold text-[#4a3620]">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 pr-10 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b5a2b]"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon visible={showNewPassword} />
                    </button>
                  </div>
                  {/* Same policy text as Signup.tsx, since this is also a
                      moment where a password is being set, and the backend's
                      validatePassword() helper enforces it here too
                      (decisions-log.md #23). */}
                  <p className="mt-1 text-xs text-[#7a6a58]">
                    At least 8 characters, with a letter, a number, and a special character.
                  </p>
                </div>

                <div>
                  <label className="block mb-1 font-semibold text-[#4a3620]">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 pr-10 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b5a2b]"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon visible={showConfirmPassword} />
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
                Reset Password
              </button>
            </form>
          )}

          {/* Shown either way (whether the form or the success message is
              currently displayed) -- lets someone bail out to Login at any
              point, same as before. */}
          <p className="text-center mt-4 text-[#4a3620]">
            Changed your mind?{" "}
            <Link to="/login" className="font-semibold text-[#8b5a2b] hover:underline">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;