import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import hero from "../assets/hero.png";
import aboutImage from "../assets/about-image.png";
import flowImage from "../assets/flow-image.png";
import flowSteps from "../assets/flow-steps.png";

function Home() {
  const navigate = useNavigate();

  // One ref per full-height section, so each header tab can scroll
  // directly to its own section. "Home" now scrolls to homeRef instead
  // of just jumping to window top -- ties it explicitly to its section,
  // same as About/Flow.
  const homeRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  // NEW: controls the mobile nav dropdown. Below the `lg` breakpoint
  // (1024px) the 6 nav items no longer fit next to the wordmark, so
  // they collapse behind this hamburger toggle instead of overflowing.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // If already logged in, skip the landing page entirely -- there's
    // no reason a signed-in user should see "Log In / Sign Up" buttons.
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/profile");
    }
  }, [navigate]);

  function scrollToHome() {
    homeRef.current?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false); // NEW: close the mobile menu after navigating
  }

  function scrollToAbout() {
    aboutRef.current?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  }

  function scrollToFlow() {
    flowRef.current?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  }

  return (
    // w-screen + relative/left-1/2/-ml-[50vw] is the "full-bleed breakout"
    // trick -- it lets this div span the ENTIRE browser width, ignoring
    // the app's normal centered 1126px column (set in index.css's #root).
    <div className="w-screen relative left-1/2 -ml-[50vw] bg-[#efe0c0] font-sans">

      {/* Sticky header. NEW: `relative` added so the mobile dropdown
          (below) can position itself directly beneath the header via
          `absolute top-full`. Padding now scales down on small screens
          (px-4 on mobile vs. px-8 on desktop) since there's less width
          to spare. */}
      <header className="sticky top-0 z-50 bg-[#f7ecd8] border-b border-[#c9a06c] px-4 sm:px-8 py-4 flex justify-between items-center relative">
        <button
          onClick={scrollToHome}
          className="text-2xl sm:text-3xl text-[#4a3620] cursor-pointer"
          style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
        >
          Potluck
        </button>

        {/* Desktop/tablet-landscape nav -- unchanged content and styling,
            just hidden below `lg` (1024px) where it no longer fits. */}
        <nav className="hidden lg:flex items-center gap-6 font-semibold">
          <button onClick={scrollToHome} className="text-[#4a3620] hover:text-[#8b5a2b]">
            Home
          </button>
          <button onClick={scrollToAbout} className="text-[#4a3620] hover:text-[#8b5a2b]">
            About
          </button>
          <button onClick={scrollToFlow} className="text-[#4a3620] hover:text-[#8b5a2b]">
            Flow
          </button>
          <Link to="/explore" className="text-[#4a3620] hover:text-[#8b5a2b]">
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

        {/* NEW: Hamburger toggle -- only shown below `lg`. Plain inline
            SVG (no icon library dependency), swaps to an "X" when open.
            This is the "genuinely necessary" mobile nav solution: same
            6 destinations, none removed, just collapsed into a menu. */}
        <button
          className="lg:hidden text-[#4a3620]"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path d="M6 6L18 18M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M4 7H20M4 12H20M4 17H20" strokeLinecap="round" />
            )}
          </svg>
        </button>

        {/* NEW: Mobile dropdown panel -- same 6 links as the desktop nav,
            same colors/typography, just stacked vertically and only
            rendered when open. Positioned directly under the header via
            `absolute top-full`, spanning the full header width. */}
        {mobileMenuOpen && (
          <nav className="lg:hidden absolute top-full left-0 w-full bg-[#f7ecd8] border-b border-[#c9a06c] flex flex-col items-center gap-4 py-6 font-semibold">
            <button onClick={scrollToHome} className="text-[#4a3620] hover:text-[#8b5a2b]">
              Home
            </button>
            <button onClick={scrollToAbout} className="text-[#4a3620] hover:text-[#8b5a2b]">
              About
            </button>
            <button onClick={scrollToFlow} className="text-[#4a3620] hover:text-[#8b5a2b]">
              Flow
            </button>
            <Link to="/explore" onClick={() => setMobileMenuOpen(false)} className="text-[#4a3620] hover:text-[#8b5a2b]">
              Explore
            </Link>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
              <button className="px-4 py-2 border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]">
                Log In
              </button>
            </Link>
            <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
              <button className="px-4 py-2 bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]">
                Sign Up
              </button>
            </Link>
          </nav>
        )}
      </header>

      {/* HOME SECTION -- min-h-[calc(100vh-72px)] was already safe
          (min-height, not a fixed height), so no structural change is
          needed here, just the two overflow-prone details below. */}
      <div ref={homeRef} className="min-h-[calc(100vh-72px)] flex flex-col scroll-mt-[88px]">
        {/* NEW: object-fill -> object-cover. object-fill was actively
            stretching/distorting the image to force-fit the box;
            object-cover crops to fill the box while keeping the image's
            real proportions -- a correctness fix, not a style change.
            Height now scales in three steps instead of a flat 60vh, so
            the image doesn't dominate a short mobile viewport. */}
        <div className="w-full h-[45vh] sm:h-[55vh] lg:h-[60vh]">
          <img
            src={hero}
            alt="People exchanging skills — teaching, coding, cooking, and more"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto px-4 sm:px-6 text-center">
          {/* NEW: whitespace-nowrap removed so this sentence wraps
              instead of forcing horizontal scroll. Font size now steps
              down on narrow screens instead of staying fixed at the
              desktop size. */}
          <p
            className="text-xl sm:text-2xl lg:text-3xl text-[#5c4326] whitespace-normal lg:whitespace-nowrap"
            style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: "8px" }}
          >
            A Barter Marketplace for Trading Any Skill — No Money, Ever.
          </p>
          <p className="text-base text-[#4a3620]" style={{ fontStyle: "italic", fontWeight: 600, marginBottom: "12px" }}>
            List a skill, get matched, and start swapping today.
          </p>
          <Link to="/signup">
            <button className="px-6 py-2 text-base font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]">
              Get Started!
            </button>
          </Link>
        </div>
      </div>

      {/* ABOUT SECTION. NEW: `h-[...]` (fixed height) -> `min-h-[...]`.
          At the fixed height, once text+image switch from a row to a
          stacked column on mobile, the stacked content is taller than
          one viewport and the fixed height would clip it. min-height
          lets the section grow to fit instead.
          Layout: `flex-col md:flex-row` -- stacked below 768px (text
          then image), side-by-side at 768px and up, exactly like the
          desktop version above that. Padding/gaps step down on smaller
          screens so there's room for the stacked content. */}
      <div ref={aboutRef} className="min-h-[calc(100vh-88px)] flex justify-center scroll-mt-[88px] p-4 sm:p-8 lg:p-16">
        <div className="bg-white/60 backdrop-blur-sm rounded-lg w-full flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto">
            <div className="flex-1 flex flex-col gap-2 text-left">
              <h2
                className="leading-none text-center"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 900,
                  color: "#4a7c59",
                  // NEW: clamp() keeps the exact 2rem desktop size but
                  // lets it scale down smoothly on narrow screens
                  // instead of staying fixed.
                  fontSize: "clamp(1.5rem, 5vw, 2rem)",
                }}
              >
                About
              </h2>
              <p className="text-[#4a3620] leading-relaxed text-justify">
                You know how to do something — fixing a bike, getting sourdough to rise, debugging code at 2 a.m.
                Somewhere out there is someone who'd love to learn exactly that, and who's got a skill of their 
                own you've always wanted to pick up.
              </p>
              <p className="text-[#4a3620] leading-relaxed text-justify">
                Right now, that trade happens by accident — a friend of a friend, a lucky DM, a flyer on a coffee
                shop wall.{" "}
                <span className="font-bold" style={{ fontStyle: "italic", color: "#4a7c59" }}>
                  Potluck makes it easier to find each other!
                </span>
              </p>
                <div
                  className="pl-4 py-3 mt-1 rounded"
                  style={{ borderLeft: "4px solid #8b5a2b", backgroundColor: "#f1e5cc" }}
                >
                  <p className="font-bold mb-1" style={{ color: "#4a7c59" }}>
                    Skills are meant to be shared, not sold.
                  </p>
                  <p style={{ color: "#4a3620" }}>
                    Everyone has something to teach — and something new to learn.
                  </p>
                </div>
            </div>
            {/* NEW: fixed w-85 -> steps down on smaller screens, and
                max-w-full + h-auto guarantee it can never force
                horizontal overflow on a narrow screen. */}
            <img src={aboutImage} alt="" className="w-48 sm:w-64 md:w-56 lg:w-85 max-w-full h-auto rounded-lg" />
          </div>
        </div>
      </div>
      
      {/* FLOW SECTION -- same structural pattern and same fixes as
          About: min-height instead of fixed height, flex-col below
          md and flex-row at md+, responsive image width, clamp()'d
          heading size. Image-then-text DOM order is preserved, so on
          mobile it stacks image-on-top-of-text, same reading order as
          it already renders in desktop's row. */}
      <div ref={flowRef} className="min-h-[calc(100vh-88px)] flex justify-center scroll-mt-[88px] p-4 sm:p-8 lg:p-16">
        <div className="bg-white/60 backdrop-blur-sm rounded-lg w-full flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 p-4 sm:p-6 lg:p-8">
          <img src={flowImage} alt="" className="w-48 sm:w-64 md:w-56 lg:w-85 max-w-full h-auto rounded-lg" />
          <div className="flex-1 flex flex-col gap-3 max-w-lg">
            <h2
              className="leading-none"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 900,
                color: "#4a7c59",
                fontSize: "clamp(1.5rem, 5vw, 2rem)",
              }}
            >
              How It Works
            </h2>
              <p className="text-[#4a3620] leading-relaxed text-justify">
                Once you've found a match, the rest is simple. No lessons hosted here, no
                calls to schedule through us — just a clear path from{" "}
                <span className="font-bold" style={{ fontStyle: "italic", color: "#b8590d" }}>
                  "I Found Someone"
                </span>{" "}
                to{" "}
                <span className="font-bold" style={{ fontStyle: "italic", color: "#4a7c59" }}>
                  "We Actually Swapped!"
                </span>
              </p>
              <img src={flowSteps} alt="Swap flow: request, accept, swap, rate" className="w-full mt-4" />
          </div>
        </div>
      </div>

      {/* FOOTER. NEW: `flex-col md:flex-row` -- text block and button
          stack vertically (centered) below 768px instead of squeezing
          into a row. Padding steps down on smaller screens. Everything
          else -- colors, the CTA button, the copyright line -- is
          untouched. */}
      <footer className="py-6 md:py-3 px-4 sm:px-8 lg:px-12" style={{ backgroundColor: "#3e2c1c" }}>
        <div className="flex flex-col md:flex-row items-center justify-between max-w-5xl mx-auto gap-4 md:gap-8">
          <div className="text-center md:text-left">
            <h2
              className="text-2xl mb-1"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#f7ecd8" }}
            >
              See What People Are Sharing
            </h2>
            <p className="text-[#d9c4a0]">
              Explore skills people are offering and looking to learn — you might find your next swap.
            </p>
          </div>
          <Link to="/explore">
            <button className="px-6 py-2 text-base font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#a97c50] whitespace-nowrap">
              Explore
            </button>
          </Link>
        </div>
        <p className="mt-10 md:mt-20 text-sm text-center" style={{ color: "#7a6a58" }}>
          © 2026 Potluck
        </p>
      </footer>

    </div>
  );
}

export default Home;
