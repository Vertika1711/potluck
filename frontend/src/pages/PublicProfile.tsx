import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

interface PublicProfileData {
  name: string;
  trustScore: number;
  completedSwapCount: number;
  joinedAt: string;
  activeListings: Listing[];
}

interface Listing {
  _id: string;
  title: string;
  description: string;
  type: "offer" | "want";
  skillTags: string[];
}

interface Rating {
  _id: string;
  raterId: { _id: string; name: string } | null;
  score: number;
  comment?: string;
  createdAt: string;
  helpfulUserIds: string[];
}

function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [sort, setSort] = useState<"recent" | "helpful">("recent");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [myId, setMyId] = useState<string | null>(null); // needed to check "have I voted"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // NEW: controls the mobile hamburger dropdown, same pattern as
  // Navbar.tsx.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function loadEverything() {
      try {
        // Step 1: find out who I am, IF logged in -- also doubles as
        // the data we need later for "have I already voted helpful."
        if (token) {
          const meRes = await axios.get("http://localhost:5000/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (meRes.data._id === userId) {
            navigate("/profile"); // viewing my own public profile -- redirect
            return;
          }

          setMyId(meRes.data._id);
        }

        // Step 2: fetch the public profile itself
        const profileRes = await axios.get(
          `http://localhost:5000/api/users/${userId}/profile`
        );
        setProfile(profileRes.data);

        // Step 3: fetch this user's ratings, respecting current sort and page
        const ratingsRes = await axios.get(
          `http://localhost:5000/api/ratings/user/${userId}?sort=${sort}&page=${page}`
        );
        setRatings(ratingsRes.data.ratings);
        setTotalPages(ratingsRes.data.totalPages);
      } catch (err) {
        setError("Failed to load this profile.");
      } finally {
        setLoading(false);
      }
    }

    loadEverything();
    // Re-runs if the sort toggle changes, so switching "Most Recent"
    // <-> "Most Helpful" re-fetches with the new order.
  }, [userId, token, navigate, sort, page]);

  // Toggles this rating's helpful vote, then updates just that one
  // rating in state using the server's response -- same "update in
  // place" pattern as SwapRequests.tsx's handleAction.
  async function toggleHelpful(ratingId: string) {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/ratings/${ratingId}/helpful`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRatings((prev) =>
        prev.map((r) => (r._id === ratingId ? response.data : r))
      );
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to update vote.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  // NEW: renders a read-only 5-star display for a given score --
  // unlike SwapRequests.tsx's renderStarInput, this isn't clickable,
  // since a review's score is fixed once submitted. Uses the app's
  // gold accent color for filled stars, matching the interactive
  // version's color choice for visual consistency.
  function renderStars(score: number) {
    return [1, 2, 3, 4, 5].map((n) => (
      <span key={n} className="text-lg" style={{ color: n <= score ? "#ffb400" : "#d9cdb8" }}>
        ★
      </span>
    ));
  }

  // NEW: shared header for this page -- deliberately NOT the full
  // shared <Navbar />, since a visitor's own logged-in nav (My Listings,
  // Suggested Matches, Swap Requests) isn't relevant while looking at
  // SOMEONE ELSE'S profile -- this is a viewing page, not a page you
  // act from. Same "simplified header" precedent as the four auth
  // pages (decisions-log #32, #41), extended slightly further here to
  // include Home/Explore, since a visitor otherwise had no way to
  // navigate anywhere except their own account. Also handles the
  // logged-out case, since this page is reachable without an account.
  // Collapses to a hamburger below `lg`, matching Navbar.tsx's fixed
  // breakpoint rule exactly -- Explore.tsx collapses at the same point
  // even with just as few items, so matching that rule keeps this
  // page's header feeling consistent with the rest of the app rather
  // than deciding per-page whether wrapping "looks fine enough." Back
  // was deliberately moved OUT of this header and placed as its own
  // block button below (matching CreateListing.tsx/ListingDetail.tsx's
  // pattern), since it's page-specific navigation, not app-wide nav.
  function renderHeader() {
    return (
      <header className="sticky top-0 z-50 bg-[#f7ecd8] border-b border-[#c9a06c] px-4 sm:px-8 py-4 flex justify-between items-center relative">
        <Link
          to="/"
          className="text-2xl sm:text-3xl text-[#4a3620]"
          style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
        >
          Potluck
        </Link>

        {/* Desktop nav -- hidden below `lg`, same breakpoint as
            Navbar.tsx. */}
        <nav className="hidden lg:flex items-center gap-6 font-semibold">
          <Link to="/" className="text-[#4a3620] hover:text-[#8b5a2b]">
            Home
          </Link>
          <Link to="/explore" className="text-[#4a3620] hover:text-[#8b5a2b]">
            Explore
          </Link>

          {token ? (
            <Link to="/profile" className="text-[#4a3620] hover:text-[#8b5a2b]">
              My Profile
            </Link>
          ) : (
            <>
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
            </>
          )}
        </nav>

        {/* Hamburger toggle -- same plain inline SVG (no icon library)
            as Navbar.tsx, switching between the hamburger and X icon
            based on mobileMenuOpen. */}
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

        {/* Mobile dropdown -- same links as the desktop nav, stacked
            vertically, closing itself after any link is clicked (same
            onNavigate pattern as Navbar.tsx). */}
        {mobileMenuOpen && (
          <nav className="lg:hidden absolute top-full left-0 w-full bg-[#f7ecd8] border-b border-[#c9a06c] flex flex-col items-center gap-4 py-6 font-semibold">
            <Link to="/" className="text-[#4a3620] hover:text-[#8b5a2b]" onClick={() => setMobileMenuOpen(false)}>
              Home
            </Link>
            <Link to="/explore" className="text-[#4a3620] hover:text-[#8b5a2b]" onClick={() => setMobileMenuOpen(false)}>
              Explore
            </Link>

            {token ? (
              <Link to="/profile" className="text-[#4a3620] hover:text-[#8b5a2b]" onClick={() => setMobileMenuOpen(false)}>
                My Profile
              </Link>
            ) : (
              <>
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
              </>
            )}
          </nav>
        )}
      </header>
    );
  }

  if (loading) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        {renderHeader()}
        <p className="text-center text-[#7a6a58] mt-16">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        {renderHeader()}
        <p className="text-center text-red-700 mt-16">{error}</p>
      </div>
    );
  }

  if (!profile) return null; // shouldn't happen, but keeps TypeScript happy below

  return (
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      {renderHeader()}

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        {/* Same navigate(-1) back button pattern as ListingDetail.tsx/
            CreateListing.tsx -- returns to whichever page the person
            actually came from (Explore's People tab, a listing's
            "Posted by" link, Suggested Matches), rather than a
            hardcoded destination. */}
        <button
          onClick={() => navigate(-1)}
          className="block mb-6 px-4 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
        >
          ← Back
        </button>

        <h1
          className="mb-4 text-center"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            color: "#4a7c59",
            fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
          }}
        >
          {profile.name}
        </h1>

        {/* NEW: trust score / completed swaps / joined date as a small,
            visually-distinct stat row -- same translucent card
            treatment used throughout the app, just for a data summary
            rather than a listing/match. Not restructured or renamed,
            per the "visually restyled for now" decision -- just given
            a real visual home instead of three plain <p> lines. */}
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 flex flex-wrap justify-center gap-6 mb-3 text-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#7a6a58]">Trust Score</p>
            <p className="text-lg font-semibold text-[#4a7c59]">{profile.trustScore.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#7a6a58]">Completed Swaps</p>
            <p className="text-lg font-semibold text-[#4a3620]">{profile.completedSwapCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#7a6a58]">Joined</p>
            <p className="text-lg font-semibold text-[#4a3620]">
              {new Date(profile.joinedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* NEW: brief explanation of what Trust Score actually means --
            same accent-box style as Home's About section / MyListings'
            Active-Closed explanation, since a first-time visitor has no
            way to infer this from the number alone. Plain text, not a
            tooltip, per the reasoning already established for
            ForgotPassword's dev-mode note and MyListings' status
            explanation -- a tooltip needs a hover/tap a visitor has no
            reason to attempt. */}
        <div
          className="pl-3 py-2 mb-8 rounded"
          style={{ borderLeft: "4px solid #8b5a2b", backgroundColor: "#f1e5cc" }}
        >
          <p className="text-sm text-center" style={{ color: "#4a3620" }}>
            <span className="font-semibold" style={{ color: "#4a7c59" }}>Trust Score</span> is the average rating this person has received from completed swaps (out of 5).
          </p>
        </div>

        <h2 className="text-lg font-semibold mb-3" style={{ color: "#4a3620" }}>
          Active Listings
        </h2>

        {profile.activeListings.length === 0 && (
          <p className="text-[#7a6a58] mb-8">No active listings.</p>
        )}

        {/* NEW: compact single-line rows instead of full Explore-style
            cards -- this is a secondary section on someone's profile,
            not a primary browsing destination, so no description and
            only a couple of tags are shown. A visitor wanting full
            detail clicks through to the listing itself. */}
        <div className="flex flex-col gap-2 mb-8">
          {profile.activeListings.map((listing) => (
            <Link
              key={listing._id}
              to={`/listing/${listing._id}`}
              className="bg-white/60 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-white/80 transition-colors"
            >
              <span
                className="text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                style={
                  listing.type === "offer"
                    ? { backgroundColor: "#e3ede3", color: "#4a7c59" }
                    : { backgroundColor: "#f4e3d0", color: "#b8590d" }
                }
              >
                {listing.type}
              </span>
              <span className="font-semibold text-[#4a3620]">{listing.title}</span>
              <div className="flex gap-1 ml-auto">
                {listing.skillTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-[#4a3620] bg-[#f1e5cc] border border-[#c9a06c] rounded-full px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
                {listing.skillTags.length > 3 && (
                  <span className="text-xs text-[#a99b82]">+{listing.skillTags.length - 3} more</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-3" style={{ color: "#4a3620" }}>
          Reviews
        </h2>

        {/* NEW: Most Recent / Most Helpful as pill buttons, matching the
            filter pattern used on Explore/MyListings/SwapRequests,
            instead of plain disabled/enabled buttons. */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => { setSort("recent"); setPage(1); }}
            className={
              "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors " +
              (sort === "recent"
                ? "bg-[#8b5a2b] text-[#f7ecd8] border-[#8b5a2b]"
                : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
            }
          >
            Most Recent
          </button>
          <button
            onClick={() => { setSort("helpful"); setPage(1); }}
            className={
              "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors " +
              (sort === "helpful"
                ? "bg-[#8b5a2b] text-[#f7ecd8] border-[#8b5a2b]"
                : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
            }
          >
            Most Helpful
          </button>
        </div>

        {ratings.length === 0 && <p className="text-[#7a6a58]">No reviews yet.</p>}

        <div className="flex flex-col gap-3">
          {ratings.map((rating) => {
            // Have I already voted this one helpful? Only relevant if
            // I'm logged in at all (myId is null for logged-out visitors).
            const iVoted = myId !== null && rating.helpfulUserIds.includes(myId);

            return (
              <div key={rating._id} className="bg-white/60 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-semibold text-[#4a3620]">
                    {rating.raterId?.name || "Deleted User"}
                  </p>
                  <div>{renderStars(rating.score)}</div>
                </div>

                {rating.comment && <p className="text-[#4a3620] mt-1">{rating.comment}</p>}

                <p className="text-xs text-[#a99b82] mt-2">
                  {new Date(rating.createdAt).toLocaleDateString()}
                </p>

                {/* Helpful voting only makes sense if logged in, and the
                    backend already blocks voting on a review ABOUT yourself
                    -- but we don't know client-side who ratedUserId is here
                    without an extra check, so we just let the backend be
                    the source of truth and surface its error if blocked. */}
                {token && (
                  <button
                    onClick={() => toggleHelpful(rating._id)}
                    className="mt-2 px-3 py-1 text-xs font-semibold border border-[#c9a06c] text-[#4a3620] rounded hover:bg-[#f1e5cc]"
                  >
                    {iVoted ? "Unmark Helpful" : "Mark Helpful"} ({rating.helpfulUserIds.length})
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Restyled Prev/Next/"Page X of Y", same structure as before,
            now matching the app's established button language --
            solid brown when enabled, faded when disabled at either
            boundary. */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-sm text-[#7a6a58]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {ratings.length > 0 && page === totalPages && (
          <p className="text-center text-[#7a6a58] mt-4">
            You've reached the end — no more reviews to show.
          </p>
        )}
      </div>
    </div>
  );
}

export default PublicProfile;