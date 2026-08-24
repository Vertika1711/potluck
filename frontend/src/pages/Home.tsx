import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import hero from "../assets/hero.png";

function Home() {
  const navigate = useNavigate();

  // Tracks which content block is showing. "home" is the default, since
  // the hero content lives inside the "Home" selection now, not above it.
  const [activeTab, setActiveTab] = useState<"home" | "about" | "flow">("home");

  // Reference to the content section, so clicking a header link scrolls
  // the page to it -- matters most when the user has scrolled further down.
  const tabSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If already logged in, skip the landing page entirely -- there's
    // no reason a signed-in user should see "Log In / Sign Up" buttons.
    // We don't verify the token here; if it's actually invalid/expired,
    // /profile already handles that case on its own.
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/profile");
    }
  }, [navigate]);

  // Switches which content is showing AND scrolls it into view -- used
  // by all three header nav buttons (Home/About/Flow). This is now the
  // ONLY way to switch tabs, since the redundant in-page tab row (which
  // duplicated these same three options) has been removed.
  function goToTab(tab: "home" | "about" | "flow") {
    setActiveTab(tab);
    tabSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    // w-screen + relative/left-1/2/-ml-[50vw] is the "full-bleed breakout"
    // trick -- it lets this div span the ENTIRE browser width, ignoring
    // the app's normal centered 1126px column (set in index.css's #root).
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans flex flex-col">

      {/* Sticky header -- "sticky top-0" keeps it pinned to the top of the
          viewport as the user scrolls. A slightly lighter cream than the
          page background, plus a bottom border, gives it visual separation
          from the content underneath it. */}
      <header className="sticky top-0 z-50 bg-[#f7ecd8] border-b border-[#c9a06c] px-8 py-4 flex justify-between items-center">
        {/* Wordmark -- bumped up to text-3xl per feedback. Playfair
            Display is loaded via Google Fonts in index.html, applied
            here with an inline style since Tailwind's default font
            utilities don't know about custom fonts unless configured
            separately. */}
        <span
          className="text-3xl text-[#4a3620]"
          style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
        >
          Potluck
        </span>

        {/* font-semibold added to every nav item per feedback, for
            stronger visibility against the header background. */}
        <nav className="flex items-center gap-6 font-semibold">
          <button onClick={() => goToTab("home")} className="text-[#4a3620] hover:text-[#8b5a2b]">
            Home
          </button>
          <button onClick={() => goToTab("about")} className="text-[#4a3620] hover:text-[#8b5a2b]">
            About
          </button>
          <button onClick={() => goToTab("flow")} className="text-[#4a3620] hover:text-[#8b5a2b]">
            Flow
          </button>
          <Link to="/browse-listings" className="text-[#4a3620] hover:text-[#8b5a2b]">
            Explore
          </Link>
          <Link to="/login">
            <button className="px-4 py-2 border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]">
              Log In
            </button>
          </Link>
          <Link to="/signup">
            <button className="px-4 py-2 bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]">
              Sign Up
            </button>
          </Link>
        </nav>
      </header>

      {/* Banner image -- the container's width caps how large it gets;
          the image's own h-auto lets its HEIGHT follow naturally from
          its real aspect ratio, so there's never empty letterbox space
          and nothing gets cropped, at any window size. */}
      <div className="w-full h-[65vh]">
        <img
          src={hero}
          alt="People exchanging skills — teaching, coding, cooking, and more"
          className="w-full h-full object-fill"
        />
      </div>

      {/* Content section -- NO in-page tab row anymore (removed per
          feedback, since it duplicated the header's own Home/About/Flow
          links). Only ONE of the three blocks below renders at a time,
          controlled entirely by the header. */}
      <div ref={tabSectionRef} className="flex-1 flex flex-col justify-start pt-1 max-w-4xl mx-auto px-6">
        {activeTab === "home" && (
          <div className="text-center">
            <p
              className="text-3xl text-[#5c4326] whitespace-nowrap"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: "8px" }}
            >
              A Barter Marketplace for Trading Any Skill — No Money, Ever.
            </p>
            <p className="text-base text-[#4a3620]" style={{ fontStyle: "italic", fontWeight: 600, marginBottom: "12px" }}>
              List a skill, get matched, and start swapping today.
            </p>
            <Link to="/signup">
              <button className="px-6 py-2 text-base bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]">
                Get Started!
              </button>
            </Link>
          </div>
        )}

        {activeTab === "about" && (
          <div className="leading-relaxed text-[#4a3620]">
            <h2 className="text-xl mb-3 text-[#3a2a17]" style={{ fontFamily: "'Playfair Display', serif" }}>
              About Potluck
            </h2>
            <p className="mb-4">
              People have real skills to offer and real gaps they need filled — and it
              has nothing to do with being technical. Someone who can cook well might
              want to learn guitar; someone who can edit video might want help with
              public speaking. This kind of exchange happens today, but only informally
              — scattered across group chats and social posts, with no way to search
              for the right person or know if they're reliable.
            </p>
            <p>
              Potluck is a lightweight, trust-aware platform where anyone — regardless
              of what kind of skill they have — can list what they can teach and what
              they want to learn, get intelligently matched with the right person, and
              build a visible track record of reliable exchanges. No money ever changes
              hands. It's a pure trade: your time and skill for someone else's.
            </p>
          </div>
        )}

        {activeTab === "flow" && (
          <div className="leading-relaxed text-[#4a3620]">
            <h2 className="text-xl mb-3 text-[#3a2a17]" style={{ fontFamily: "'Playfair Display', serif" }}>
              How it flows
            </h2>
            <p className="mb-4">
              List a skill you can teach, or describe what you want to learn — Potluck
              turns a plain-language goal into the actual skills involved. From there,
              a matching engine ranks the best people to trade with, based on what you
              offer and what they need, and vice versa.
            </p>
            <p>
              Send a swap request, and once it's accepted, you're connected to
              coordinate the exchange however works best for you — a call, a video
              chat, or in person. Once it's done, mark the swap complete and rate each
              other, building a visible trust score that follows you across the
              platform.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;