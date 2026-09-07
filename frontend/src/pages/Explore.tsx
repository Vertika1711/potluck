import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { getAvatarSrc } from "../utils/avatar";
import { API_URL } from "../config";

// Describes the shape of one listing coming back from the backend,
// so TypeScript knows what fields we can safely use below.
interface Listing {
  _id: string;
  userId: string;
  title: string;
  description: string;
  type: "offer" | "want";
  skillTags: string[];
  status: string;
  createdAt: string;
}

// Minimal shape of a user returned by GET /api/users/search -- only the
// public-safe fields needed to render a result card and link to their
// public profile. Adjust field names here if your actual search route
// returns a different shape (check your "Search Users" Postman request).
interface UserSearchResult {
  _id: string;
  name: string;
  trustScore?: number;
  createdAt: string;
  avatarId?: number; // NEW -- see Profile.tsx's User interface for the same field
}

function Explore() {
  // Starts as an empty array -- gets filled in once the fetch below completes
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState("");

  // NEW: which top-level view is active -- "listings" is the original
  // page content, "people" is the new name-search view. Kept as a single
  // tab switcher on this one page rather than a separate route, per the
  // decision to fold user search into Explore instead of building a
  // second dedicated page.
  const [activeTab, setActiveTab] = useState<"listings" | "people">("listings");

  // Holds whatever the user has typed into the skill-tag search box.
  const [searchQuery, setSearchQuery] = useState("");

  // NEW: which listing type is currently selected -- "all" shows
  // everything, matching the default (unfiltered) behavior from before.
  const [typeFilter, setTypeFilter] = useState<"all" | "offer" | "want">("all");

  // NEW: how many of the filtered results are currently shown. Starts at
  // 12 and grows by 12 each time "Load More" is clicked -- a frontend-only
  // reveal, not a separate backend fetch, since GET /api/listings already
  // returns everything in one call and the skill-tag search needs the
  // full list in memory to work correctly across all listings, not just
  // whatever page happens to be loaded.
  const [visibleCount, setVisibleCount] = useState(12);

  // NEW: state for the People tab -- separate from the listings search,
  // since this one hits the backend (GET /api/users/search) instead of
  // filtering data already in memory.
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [userSearchError, setUserSearchError] = useState("");
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  // NEW: debounced user search. Waits 300ms after the person stops typing
  // before actually calling the backend, so it's not firing a request on
  // every keystroke -- a lightweight version of the same reasoning behind
  // deferring live AI-relatedness search (decisions-log.md #15), just
  // with a plain (cheap) query instead of an AI call.
  useEffect(() => {
    if (activeTab !== "people") return;

    if (userQuery.trim() === "") {
      setUserResults([]);
      setUserSearchError("");
      return;
    }

    setUserSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/users/search?q=${encodeURIComponent(userQuery)}`
        );
        setUserResults(response.data);
        setUserSearchError("");
      } catch (err) {
        setUserSearchError("Failed to search users.");
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [userQuery, activeTab]);

  // useEffect with an empty dependency array [] means:
  // "run this once, right when the component first appears on screen."
  // Same pattern as Profile.tsx fetching /me on load.
  useEffect(() => {
    async function fetchListings() {
      try {
        // No Authorization header needed here -- this route is public,
        // matching how we built GET /api/listings on the backend.
        const response = await axios.get(`${API_URL}/api/listings`);
        setListings(response.data);
      } catch (err) {
        setError("Failed to load listings.");
      }
    }

    fetchListings();
  }, []);

  // Derived from "listings" + "searchQuery" on every render -- NOT its own
  // separate state. This is deliberate: listings is the single source of
  // truth fetched from the backend, and the filtered view is just a
  // computed slice of it. Keeping a second "filtered listings" state in
  // sync with the original would be extra bookkeeping for no real benefit
  // here.
  //
  // A listing matches if the search query is empty (show everything),
  // OR if ANY of its skillTags contains the query text, case-insensitive.
  // NEW: also requires the listing's type to match the selected filter,
  // unless "all" is selected.
  const filteredListings = listings.filter((listing) => {
    if (typeFilter !== "all" && listing.type !== typeFilter) return false;

    if (searchQuery.trim() === "") return true;

    const query = searchQuery.toLowerCase();
    return listing.skillTags.some((tag) => tag.toLowerCase().includes(query));
  });

  // NEW: whenever the search text or type filter changes, start back at
  // 12 visible results -- otherwise a new, narrower search could leave
  // "Load More" in a confusing state (e.g. already past the end of the
  // new, smaller result set).
  useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, typeFilter]);

  // Only this many of the filtered results are actually rendered --
  // "Load More" increases visibleCount, revealing more of what's already
  // in memory rather than triggering a new fetch.
  const visibleListings = filteredListings.slice(0, visibleCount);

  return (
    // Same full-bleed pattern as Home/auth pages (decisions-log.md #27) --
    // lets the cream background span the full browser width, even though
    // the header still needs to be full-width while the actual content
    // below sits in a centered, readable column.
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">

      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-4 pb-8">
        {/* Displayed heading only -- "Explore" instead of "Explore
            Listings", since this page now covers both listings and
            people. Component name, file name, and every variable/comment
            stay as Explore/listings/filteredListings, unchanged. */}
        <h1
          className="mb-6 text-center"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            color: "#4a7c59",
            fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
          }}
        >
          Explore
        </h1>

        {/* Top-level tab switcher between the two things this page now
            covers -- finding a listing, or finding a person. Visually
            distinct from the type-filter pills below (larger, sits above
            everything else) so it reads as switching the whole view, not
            another filter within Listings. */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveTab("listings")}
            className={
              "px-5 py-2 rounded-full font-semibold border-2 transition-colors " +
              (activeTab === "listings"
                ? "bg-[#4a7c59] text-white border-[#4a7c59]"
                : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
            }
          >
            Listings
          </button>
          <button
            onClick={() => setActiveTab("people")}
            className={
              "px-5 py-2 rounded-full font-semibold border-2 transition-colors " +
              (activeTab === "people"
                ? "bg-[#4a7c59] text-white border-[#4a7c59]"
                : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
            }
          >
            People
          </button>
        </div>

        {error && (
          <p
            className="mb-4 text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2 max-w-md"
            style={{ margin: "0 auto 16px" }}
          >
            {error}
          </p>
        )}

        {activeTab === "listings" && (
        <>

        {/* Skill-tag search box -- filtering happens live as you type, no
            separate "Search" button needed since this is all client-side
            and instant (no backend round-trip). Styled to match every
            other input across the app. NEW: a magnifying-glass icon sits
            inside the input's left edge (relative/absolute wrapper, same
            technique as the password-toggle buttons on the auth pages);
            pl-10 on the input keeps typed text clear of the icon. */}
        <div className="relative w-full max-w-sm mx-auto mb-8">
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a99b82] pointer-events-none"
          >
            <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 21L16.65 16.65" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by skill tag (e.g. cooking, guitar)..."
            className="w-full pl-10 pr-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
          />
        </div>

        {/* Type filter -- three pill buttons, active one highlighted.
            Combines with the search box (AND logic, see filteredListings
            above): a listing must match both the selected type and the
            search text to show up. */}
        <div className="flex justify-center gap-3 mb-8">
          {(["all", "offer", "want"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={
                "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors " +
                (typeFilter === type
                  ? "bg-[#8b5a2b] text-[#f7ecd8] border-[#8b5a2b]"
                  : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
              }
            >
              {type === "all" ? "All" : type === "offer" ? "Offers" : "Wants"}
            </button>
          ))}
        </div>

        {/* Friendly message when a search finds nothing, instead of just
            silently showing an empty page with no explanation. */}
        {searchQuery.trim() !== "" && filteredListings.length === 0 && (
          <p className="text-center text-[#4a3620] mb-6">No listings match "{searchQuery}".</p>
        )}

        {/* Responsive card grid: 1 column on mobile, 2 on tablet, 3 on
            desktop -- .map() turns each listing object into a visible
            card. "key" is required by React whenever rendering a list --
            it uses the listing's unique _id to keep track of each item
            efficiently. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleListings.map((listing) => (
            // The whole card is the Link (not just the title). A hover
            // treatment (slightly more opaque background) gives visual
            // feedback that the entire card is clickable.
            <Link
              key={listing._id}
              to={`/listing/${listing._id}`}
              className="bg-white/60 backdrop-blur-sm rounded-lg p-5 flex flex-col gap-2 hover:bg-white/80 transition-colors"
            >
              <span className="text-lg font-semibold text-[#4a3620]">
                {listing.title}
              </span>

              {/* Type badge -- green for "offer" (matches the site's
                  accent green), warm brown/orange for "want", so the two
                  listing types are visually distinct at a glance. */}
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

              <p className="text-sm text-[#4a3620] line-clamp-3">{listing.description}</p>

              {/* Tags rendered as individual pill badges instead of a
                  plain comma-joined string, matching the tag-chip visual
                  language already used elsewhere in the app (e.g.
                  MyListings.tsx/Profile.tsx's editors). */}
              <div className="flex flex-wrap gap-1 mt-1">
                {listing.skillTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-[#4a3620] bg-[#f1e5cc] border border-[#c9a06c] rounded-full px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        {/* Only shown when there are more results beyond what's
            currently visible. Clicking reveals 12 more from the already-
            fetched filteredListings -- no network request happens here. */}
        {visibleCount < filteredListings.length && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setVisibleCount((c) => c + 12)}
              className="px-6 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              Load More
            </button>
          </div>
        )}

        {/* NEW: end-of-list message, shown once every filtered result is
            already visible -- mirrors Suggested Matches' equivalent
            message, so every paginated page in the app confirms the
            same way that scrolling further won't reveal anything new. */}
        {visibleListings.length > 0 && visibleCount >= filteredListings.length && (
          <p className="text-center text-[#7a6a58] mt-8">
            That's all the listings available.
          </p>
        )}
        </>
        )}

        {activeTab === "people" && (
          <>
            {/* Same input styling/icon as the listings search box, just a
                different placeholder and wired to userQuery instead. */}
            <div className="relative w-full max-w-sm mx-auto mb-8">
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a99b82] pointer-events-none"
              >
                <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 21L16.65 16.65" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-10 pr-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
              />
            </div>

            {userSearchError && (
              <p
                className="mb-4 text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2 max-w-md"
                style={{ margin: "0 auto 16px" }}
              >
                {userSearchError}
              </p>
            )}

            {userSearchLoading && (
              <p className="text-center text-[#7a6a58] text-sm mb-4">Searching...</p>
            )}

            {!userSearchLoading && userQuery.trim() !== "" && userResults.length === 0 && !userSearchError && (
              <p className="text-center text-[#4a3620] mb-6">No users match "{userQuery}".</p>
            )}

            {userQuery.trim() === "" && (
              <p className="text-center text-[#7a6a58] mb-6">Start typing a name to find someone on Potluck.</p>
            )}

            {/* Same card grid pattern as Listings, sized down to 2 columns
                max since a person-card has far less content than a
                listing-card -- a 3-column layout would leave them looking
                sparse. Whole card links to their public profile, same
                "entire card is clickable" pattern as the listing cards. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {userResults.map((user) => (
                // UPDATED: switched from a stacked flex-col layout to a
                // flex-row -- avatar on the left, details on the right --
                // now that each person has a real illustrated avatar to
                // show, rather than just text. items-center keeps the
                // avatar vertically centered against the (usually taller)
                // text block beside it.
                <Link
                  key={user._id}
                  to={`/profile/${user._id}`}
                  className="bg-white/60 backdrop-blur-sm rounded-lg p-5 flex items-center gap-4 hover:bg-white/80 transition-colors"
                >
                  {/* Sized larger than the small inline avatars used
                      elsewhere (e.g. Profile.tsx's 14/PublicProfile's 20)
                      since this card has room to spare and the avatar is
                      effectively the card's main visual anchor now. */}
                  <img
                    src={getAvatarSrc(user._id, user.avatarId)}
                    alt=""
                    className="w-16 h-16 rounded-full object-cover shrink-0"
                    style={{ border: "3px solid #c9a06c" }}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-semibold text-[#4a3620]">{user.name}</span>
                    {typeof user.trustScore === "number" && (
                      <span className="text-sm text-[#7a6a58]">Trust Score: {user.trustScore.toFixed(1)}</span>
                    )}
                    <span className="text-xs text-[#a99b82]">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Explore;