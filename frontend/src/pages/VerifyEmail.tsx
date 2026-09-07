import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";

function VerifyEmail() {
  // Reads the token straight out of the URL -- e.g. for
  // /verify-email/abc123, useParams gives us { token: "abc123" }.
  // Same technique ResetPassword.tsx uses for :token.
  const { token } = useParams();
  const navigate = useNavigate();

  // Three possible states while/after the verification call runs:
  // "verifying" (in flight), "success", or "error" -- rendered as
  // three distinct views below, similar in spirit to ResetPassword.tsx's
  // message-vs-form branching, just with an extra initial loading state
  // since this page's whole job starts automatically on page load
  // rather than waiting for a form submission.
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");

  // NEW: guards against React StrictMode's intentional double-invocation
  // of effects in development, which would otherwise fire this
  // verification request TWICE -- the first succeeds and clears the
  // token (same one-time-use pattern as ResetPassword.tsx), the second
  // then fails since the token's already gone, incorrectly showing an
  // error even though verification actually succeeded. A ref (not
  // state) is used here specifically because updating it doesn't
  // trigger a re-render, and its value persists across StrictMode's
  // double-mount without resetting -- exactly the "did this already
  // run" flag we need.
  const hasRun = useRef(false);

  // Runs once automatically when the page loads -- no button click
  // needed, since the token itself (from the emailed link) is the only
  // input this page needs.
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function verify() {
      try {
        const response = await axios.get(`${API_URL}/api/auth/verify-email/${token}`);
        setMessage(response.data.message);
        setStatus("success");

        // NEW: auto-redirect to Login after a delay, same pattern as
        // ResetPassword.tsx -- but 5 seconds instead of 2, since this
        // page's success message has more to read, and may often be
        // opened on a phone (e.g. straight from an email app) where
        // tapping through takes a moment longer.
        setTimeout(() => navigate("/login"), 5000);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response) {
          setMessage(err.response.data.error || "Something went wrong.");
        } else {
          setMessage("Something went wrong.");
        }
        setStatus("error");
      }
    }

    verify();
  }, [token, navigate]);

  return (
    // Same full-bleed pattern as every other auth page (decisions-log.md #27).
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
        <div className="w-full max-w-sm sm:max-w-md bg-white/60 backdrop-blur-sm rounded-lg p-6 sm:p-8 text-center">
          <h1
            className="mb-4"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              color: "#4a7c59",
              fontSize: "clamp(1.5rem, 5vw, 2rem)",
            }}
          >
            Email Verification
          </h1>

          {status === "verifying" && (
            <p className="text-[#7a6a58]">Verifying your email...</p>
          )}

          {status === "success" && (
            <>
              <p className="text-sm text-[#4a7c59] bg-[#eef4ee] border border-[#a9c9b0] rounded px-3 py-2">
                {message} Redirecting to login...
              </p>
              <p className="mt-4 text-[#4a3620]">
                <Link to="/login" className="font-semibold text-[#8b5a2b] hover:underline">
                  Click here if you're not redirected automatically
                </Link>
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <p className="text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">
                {message}
              </p>
              {/* No redirect on failure -- unlike success, there's
                  nothing useful to redirect TO automatically here. The
                  person needs to actively request a new link, which
                  they can do from Login's own "Resend verification
                  email" option once they enter their email there. */}
              <p className="mt-4 text-[#4a3620]">
                <Link to="/login" className="font-semibold text-[#8b5a2b] hover:underline">
                  Back to Log In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;