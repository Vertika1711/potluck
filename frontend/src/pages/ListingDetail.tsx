import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";

interface Listing {
  _id: string;
  userId: { _id: string; name: string };
  title: string;
  description: string;
  type: "offer" | "want";
  skillTags: string[];
  status: string;
  createdAt: string;
}

function ListingDetail() {
  // useParams reads the dynamic part of the URL -- if this page is
  // reached via /listing/abc123, then id === "abc123". This matches
  // the :id placeholder we'll define in the route in App.tsx.
  const { id } = useParams();
  const navigate = useNavigate();

  const [listing, setListing] = useState<Listing | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");

  // NEW: controls the header's mobile nav dropdown, same pattern as
  // Home.tsx/Explore.tsx.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function fetchListing() {
      try {
        const response = await axios.get(`http://localhost:5000/api/listings/${id}`);
        setListing(response.data);

        if (token) {
          const profileRes = await axios.get("http://localhost:5000/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMyId(profileRes.data._id);
        }
      } catch (err) {
        setError("Failed to load this listing.");
      }
    }

    fetchListing();
  }, [id, token]);

  // Same request-swap logic as Explore.tsx, just living here
  // now instead -- this page becomes the ONE place swap requests
  // actually get sent from.
  async function handleRequestSwap() {
    if (!token || !listing) {
      setError("You must be logged in to request a swap.");
      return;
    }

    try {
      await axios.post(
        "http://localhost:5000/api/swaps",
        { listingId: listing._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequested(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to send swap request.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  // NEW: the header (with Home/Log In/Sign Up + hamburger) is shared by
  // every state this page can be in -- loading, error, and loaded --
  // so it's pulled out here instead of repeated three times below.
  function Header() {
    return (
      <header className="sticky top-0 z-50 bg-[#f7ecd8] border-b border-[#c9a06c] px-4 sm:px-8 py-4 flex justify-between items-center relative">
        <Link
          to="/"
          className="text-2xl sm:text-3xl text-[#4a3620]"
          style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
        >
          Potluck
        </Link>

        <nav className="hidden lg:flex items-center gap-6 font-semibold">
          <Link to="/" className="text-[#4a3620] hover:text-[#8b5a2b]">
            Home
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

        {mobileMenuOpen && (
          <nav className="lg:hidden absolute top-full left-0 w-full bg-[#f7ecd8] border-b border-[#c9a06c] flex flex-col items-center gap-4 py-6 font-semibold">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-[#4a3620] hover:text-[#8b5a2b]">
              Home
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
    );
  }

  if (error) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        <Header />
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
          <p
            className="text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2 max-w-md"
            style={{ margin: "0 auto" }}
          >
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        <Header />
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
          <p className="text-center text-[#7a6a58]">Loading...</p>
        </div>
      </div>
    );
  }

  // listing.userId is the POPULATED object ({ _id, name }) since the
  // backend route uses .populate() -- so listing.userId._id is what
  // we compare against myId, and listing.userId.name is what we display.
  const isOwnListing = myId === listing.userId._id;

  return (
    // Same full-bleed pattern as every other restyled page (decisions-log.md #27).
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      <Header />

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        {/* NEW: navigate(-1) returns to whatever page the person actually
            came from (Explore, a public profile, Suggested Matches,
            etc.), instead of always assuming Explore specifically. */}
        {/* NEW: `block` overrides the centering this button was
            inheriting -- index.css's #root rule sets text-align: center
            globally, which centers inline-block elements like a default
            <button> within their container. Making it a block-level
            element positions it at the container's left edge instead. */}
        <button
          onClick={() => navigate(-1)}
          className="block mb-6 px-4 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
        >
          ← Back
        </button>

        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-6 sm:p-8 flex flex-col gap-3">
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              color: "#4a7c59",
              fontSize: "clamp(1.5rem, 5vw, 2rem)",
            }}
          >
            {listing.title}
          </h2>

          {/* Same type badge style as Explore's cards, so a listing looks
              consistent whether you're browsing the grid or viewing this
              detail page. */}
          <span
            className="self-start text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
            style={
              listing.type === "offer"
                ? { backgroundColor: "#e3ede3", color: "#4a7c59" }
                : { backgroundColor: "#f4e3d0", color: "#b8590d" }
            }
          >
            {listing.type}
          </span>

          {/* NEW: "Posted by" now links to the poster's public profile --
              previously plain text. This is one of the few real entry
              points into PublicProfile.tsx now that it's reachable via
              Explore's People tab too. */}
          {/* NEW: grouped into one div with a small internal gap, so
              "Posted by" and "Posted on" read as one related unit,
              distinct from the description below. Previously both were
              separate flex children of the card, so they picked up the
              same gap-3 spacing as everything else -- with no visual
              distinction between "closely related" and "just the next
              item." */}
          <div className="flex flex-col gap-0.5">
            <p className="text-[#4a3620]">
              Posted by{" "}
              <Link to={`/profile/${listing.userId._id}`} className="font-semibold text-[#8b5a2b] hover:underline">
                {listing.userId.name}
              </Link>
            </p>

            {/* Posting date. Assumes GET /api/listings/:id returns
                createdAt (it does on every other Listing shape in the
                app, e.g. Explore.tsx's) -- worth a quick Postman check
                on this specific route if the date doesn't show up
                correctly. */}
            <p className="text-sm text-[#7a6a58]">
              Posted on {new Date(listing.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Extra breathing room above the description, beyond the
              card's normal gap-3, so it visually separates from the
              Posted by/Posted on group above it. Uses an inline style
              instead of a Tailwind mt-* class -- index.css's unlayered
              `p { margin: 0; }` rule would otherwise silently zero out
              a Tailwind margin class on a <p> (decisions-log.md #26,
              #29, #35). */}
          <p className="text-[#4a3620] leading-relaxed" style={{ marginTop: "8px" }}>
            {listing.description}
          </p>

          {/* Tags as pill badges, matching Explore's cards. */}
          <div className="flex flex-wrap gap-1">
            {listing.skillTags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-[#4a3620] bg-[#f1e5cc] border border-[#c9a06c] rounded-full px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>

          {!isOwnListing && myId && (
            <button
              onClick={handleRequestSwap}
              disabled={requested}
              className={
                "mt-2 self-start px-6 py-2 font-semibold rounded transition-colors " +
                (requested
                  ? "bg-[#e3ede3] text-[#4a7c59] cursor-default"
                  : "bg-[#8b5a2b] text-[#f7ecd8] hover:bg-[#7a4a22]")
              }
            >
              {requested ? "Requested!" : "Request Swap"}
            </button>
          )}

          {/* NEW: previously, a logged-out visitor just saw nothing at
              all where the button would be -- no indication that
              logging in would let them take this action. Extra space
              above via inline style, same reasoning as the description's
              spacing above -- a Tailwind mt-* class on a <p> would be
              silently zeroed out by index.css's unlayered rule. */}
          {!isOwnListing && !myId && (
            <p className="text-[#4a3620]" style={{ marginTop: "12px" }}>
              <Link to="/login" className="font-semibold text-[#8b5a2b] hover:underline">
                Log in
              </Link>{" "}
              to Request a Swap.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ListingDetail;