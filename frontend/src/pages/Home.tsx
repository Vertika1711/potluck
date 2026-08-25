import { useEffect, useRef } from "react";
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
  }

  function scrollToAbout() {
    aboutRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollToFlow() {
    // Flow's section doesn't exist yet -- this is a no-op until it's
    // built next, per the plan to do Home + About first.
    flowRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    // w-screen + relative/left-1/2/-ml-[50vw] is the "full-bleed breakout"
    // trick -- it lets this div span the ENTIRE browser width, ignoring
    // the app's normal centered 1126px column (set in index.css's #root).
    <div className="w-screen relative left-1/2 -ml-[50vw] bg-[#efe0c0] font-sans">

      {/* Sticky header -- unchanged from before. */}
      <header className="sticky top-0 z-50 bg-[#f7ecd8] border-b border-[#c9a06c] px-8 py-4 flex justify-between items-center">
        <button
          onClick={scrollToHome}
          className="text-3xl text-[#4a3620] cursor-pointer"
          style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
        >
          Potluck
        </button>

        <nav className="flex items-center gap-6 font-semibold">
          <button onClick={scrollToHome} className="text-[#4a3620] hover:text-[#8b5a2b]">
            Home
          </button>
          <button onClick={scrollToAbout} className="text-[#4a3620] hover:text-[#8b5a2b]">
            About
          </button>
          <button onClick={scrollToFlow} className="text-[#4a3620] hover:text-[#8b5a2b]">
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

      {/* HOME SECTION -- min-h-screen makes it fill at least one full
          viewport height. Everything inside (image, tagline, subtitle,
          button) is EXACTLY as it was before -- only the wrapping
          around it has changed, not its own content or styling. */}
      <div ref={homeRef} className="min-h-[calc(100vh-72px)] flex flex-col scroll-mt-[88px]">
        <div className="w-full h-[60vh]">
          <img
            src={hero}
            alt="People exchanging skills — teaching, coding, cooking, and more"
            className="w-full h-full object-fill"
          />
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto px-6 text-center">
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
            <button className="px-6 py-2 text-base font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]">
              Get Started!
            </button>
          </Link>
        </div>
      </div>

      {/* ABOUT SECTION -- min-h-[calc(100vh-88px)] instead of min-h-screen: 
          without this, the section is sized for the FULL viewport height, but
          scroll-mt-[88px] only leaves 88px of room below the sticky header -- 
          mismatched numbers meant this section always overshot the bottom of 
          the window. Matching both to 88px keeps the section's bottom flush with
          the window's bottom when scrolled to. */}
      <div ref={aboutRef} className="h-[calc(100vh-88px)] flex justify-center scroll-mt-[88px] p-16">
        <div className="bg-white/60 backdrop-blur-sm rounded-lg w-full h-full flex items-center justify-center gap-8 p-8">
          <div className="flex items-center gap-4 max-w-4xl mx-auto">
            <div className="flex-1 flex flex-col gap-2 text-left">
              <h2
                className="leading-none text-center"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 900,
                  color: "#4a7c59",
                  fontSize: "2rem",
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
            <img src={aboutImage} alt="" className="w-85 rounded-lg" />
          </div>
        </div>
      </div>
      
      {/* FLOW SECTION -- same structural pattern as About: fixed height
          matching the viewport-minus-header, scroll-mt-[88px] so the
          sticky header doesn't cover it when scrolled to, and a
          translucent white box centered with p-16 padding on all sides.
          Content is a placeholder for now, same as About started. */}
      <div ref={flowRef} className="h-[calc(100vh-88px)] flex justify-center scroll-mt-[88px] p-16">
        <div className="bg-white/60 backdrop-blur-sm rounded-lg w-full h-full flex items-center justify-center gap-8 p-8">
          <img src={flowImage} alt="" className="w-85 rounded-lg" />
          <div className="flex-1 flex flex-col gap-3 max-w-lg">
            <h2
              className="leading-none"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 900,
                color: "#4a7c59",
                fontSize: "2rem",
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

      {/* FOOTER -- dark brown background, distinct from the page's cream
          tone, with a heading, short line, a CTA button linking to
          Browse Listings, and a subtle copyright line at the very
          bottom in a muted/faded color so it doesn't compete with the
          CTA above it. */}
      <footer className="py-3 px-12" style={{ backgroundColor: "#3e2c1c" }}>
        <div className="flex items-center justify-between max-w-5xl mx-auto gap-8">
          <div className="text-left">
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
          <Link to="/browse-listings">
            <button className="px-6 py-2 text-base font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#a97c50] whitespace-nowrap">
              Explore Listings
            </button>
          </Link>
        </div>
        <p className="mt-20 text-sm text-center" style={{ color: "#7a6a58" }}>
          © 2026 Potluck
        </p>
      </footer>

    </div>
  );
}

export default Home;