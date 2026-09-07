import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { API_URL } from "../config";

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

// NEW: same date-preset type as MyReviews.tsx -- "custom" reveals two
// extra date inputs, the other three compute their own start/end
// automatically.
type DatePreset = "all" | "7days" | "30days" | "custom";

function MyListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState("");

  // Tracks WHICH listing (by _id) is currently being edited, if any.
  // null means "nothing is being edited right now" -- all cards show normally.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Separate state just for the fields currently being edited --
  // kept apart from the main "listings" array so typing in the edit
  // form doesn't affect the displayed list until you actually save.
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSkillTags, setEditSkillTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");

  // NEW: type filter, same All/Offers/Wants pattern as Explore.
  const [typeFilter, setTypeFilter] = useState<"all" | "offer" | "want">("all");

  // NEW: Active/Closed status filter -- a second, independent filter
  // dimension alongside typeFilter, not mutually exclusive with it (a
  // user can filter to "Offers" AND "Closed" at the same time). Same
  // pill-button pattern as typeFilter, just one more row.
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");

  // NEW: Newest/Oldest sort toggle. Defaults to "newest", matching what
  // GET /api/listings already returns (newest first) -- so this
  // doesn't change anything visually until the user explicitly picks
  // "Oldest First".
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // NEW: date-range filter, same preset pattern as MyReviews.tsx --
  // filters by createdAt. Unlike the type/status/sort controls above
  // (which all apply live, instantly), presets here ALSO apply live --
  // only "Custom range" needs an explicit Apply, since it depends on
  // TWO separate date inputs both being set before filtering makes
  // sense (applying after only the start date is picked would show a
  // confusing, incomplete result).
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  // The ACTUAL applied custom range -- only updated when "Apply" is
  // clicked, so typing/picking dates doesn't filter anything until
  // both ends are deliberately confirmed.
  const [appliedCustomStart, setAppliedCustomStart] = useState("");
  const [appliedCustomEnd, setAppliedCustomEnd] = useState("");

  // NEW: pagination, same "reveal more of what's already fetched"
  // pattern as Explore.tsx's visibleCount -- no extra network request,
  // just slicing further into an already-filtered/sorted array. Page
  // size of 6 (smaller than Explore's 12) since each card here is a
  // full-width block with much more content per card (tags, dates,
  // three action buttons, an inline edit form) than Explore's compact
  // grid cards.
  const [visibleCount, setVisibleCount] = useState(6);

  const token = localStorage.getItem("token");

  // NEW: protected-route check, same pattern as Profile.tsx/CreateListing.tsx --
  // this page previously had no redirect at all for a logged-out visitor;
  // it would just silently fail with a generic "Failed to load" error
  // instead of sending them to /login.
  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return; // don't bother fetching if we're about to redirect anyway

    async function fetchMyListings() {
      try {
        // The backend's GET /api/listings returns ALL active listings,
        // not just yours -- so we fetch everything, then filter down
        // to only the ones where userId matches YOUR own profile id.
        const [listingsRes, profileRes] = await Promise.all([
          axios.get(`${API_URL}/api/listings`),
          axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const myId = profileRes.data._id;
        const mine = listingsRes.data.filter((listing: Listing) => listing.userId === myId);
        setListings(mine);
      } catch (err) {
        setError("Failed to load your listings.");
      }
    }

    fetchMyListings();
  }, [token]);

  // Avoids flashing this page's content for a split second before the
  // redirect above actually happens.
  if (!token) return null;

  // NEW: computes the actual [start, end] Date range to filter against,
  // based on the current preset -- for "all", returns null (no date
  // filtering at all). For "custom", uses the APPLIED dates, not the
  // draft ones being typed/picked, so nothing filters until Apply is
  // clicked.
  function getActiveDateRange(): { start: Date; end: Date } | null {
    const now = new Date();

    if (datePreset === "7days") {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      return { start: sevenDaysAgo, end: now };
    }

    if (datePreset === "30days") {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return { start: thirtyDaysAgo, end: now };
    }

    if (datePreset === "custom") {
      if (!appliedCustomStart || !appliedCustomEnd) return null;
      // End date extended to the end of that day, so a date-only value
      // includes the whole day, same reasoning as the backend's
      // ratings date-filter logic.
      return {
        start: new Date(appliedCustomStart),
        end: new Date(`${appliedCustomEnd}T23:59:59.999`),
      };
    }

    return null; // "all" -- no filter
  }

  function applyCustomRange() {
    setAppliedCustomStart(customStart);
    setAppliedCustomEnd(customEnd);
  }

  // Resets the date filter back to "all time" immediately -- same
  // "clearing is a reset action, not a new selection to review" idea
  // as MyReviews.tsx's clearFilter.
  function clearDateFilter() {
    setDatePreset("all");
    setCustomStart("");
    setCustomEnd("");
    setAppliedCustomStart("");
    setAppliedCustomEnd("");
  }

  // Derived, same pattern as Explore's filteredListings -- not its own
  // separate state, just a filtered view of the fetched listings.
  // UPDATED: now also filters by statusFilter, and by the date range
  // (if one is active), before sorting and pagination. Order: filter
  // every dimension first (so counts/pagination reflect the actually-
  // narrowed set), sort second, slice last.
  const dateRange = getActiveDateRange();
  const filteredListings = listings
    .filter((listing) => typeFilter === "all" || listing.type === typeFilter)
    .filter((listing) => statusFilter === "all" || listing.status === statusFilter)
    .filter((listing) => {
      if (!dateRange) return true;
      const created = new Date(listing.createdAt).getTime();
      return created >= dateRange.start.getTime() && created <= dateRange.end.getTime();
    })
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

  // NEW: whenever any filter or the sort order changes, reset back to
  // showing just the first page -- same reasoning as Explore.tsx's
  // equivalent effect: otherwise a newly narrowed/reordered list could
  // leave "Load More" in a confusing state relative to what's actually
  // being shown. UPDATED: also resets on the date preset changing and
  // on the applied custom range changing (i.e. after clicking Apply).
  useEffect(() => {
    setVisibleCount(6);
  }, [typeFilter, statusFilter, sortOrder, datePreset, appliedCustomStart, appliedCustomEnd]);

  // NEW: only this many of the filtered+sorted results are actually
  // rendered -- "Load More" increases visibleCount, revealing more of
  // what's already in memory rather than triggering a new fetch, same
  // principle as Explore.tsx's visibleListings.
  const visibleListings = filteredListings.slice(0, visibleCount);

  // Called when clicking "Edit" on a specific listing card --
  // pre-fills the edit form with that listing's current values.
  function startEditing(listing: Listing) {
    setEditingId(listing._id);
    setEditTitle(listing.title);
    setEditDescription(listing.description);
    setEditSkillTags(listing.skillTags);
    setNewTagInput("");
  }

  function cancelEditing() {
    setEditingId(null);
  }

  function addTag() {
    const trimmed = newTagInput.trim();
    if (trimmed === "" || editSkillTags.includes(trimmed)) return;
    setEditSkillTags((prev) => [...prev, trimmed]);
    setNewTagInput("");
  }

  function removeTag(tag: string) {
    setEditSkillTags((prev) => prev.filter((t) => t !== tag));
  }

  async function saveEdit(id: string) {
    try {
      const response = await axios.put(
        `${API_URL}/api/listings/${id}`,
        { title: editTitle, description: editDescription, skillTags: editSkillTags },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setListings((prev) =>
        prev.map((listing) => (listing._id === id ? response.data : listing))
      );
      setEditingId(null);
    } catch (err) {
      setError("Failed to update listing.");
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Are you sure you want to delete this listing?");
    if (!confirmed) return;

    try {
      await axios.delete(`${API_URL}/api/listings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setListings((prev) => prev.filter((listing) => listing._id !== id));
    } catch (err) {
      setError("Failed to delete listing.");
    }
  }

  async function handleToggleStatus(listing: Listing) {
    const newStatus = listing.status === "active" ? "closed" : "active";

    try {
      const response = await axios.put(
        `${API_URL}/api/listings/${listing._id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setListings((prev) =>
        prev.map((l) => (l._id === listing._id ? response.data : l))
      );
    } catch (err) {
      setError("Failed to update listing status.");
    }
  }

  return (
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              color: "#4a7c59",
              fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
            }}
          >
            My Listings
          </h1>

          {/* NEW: previously there was no link anywhere on this page to
              create a new listing -- this is the natural place for it. */}
          <Link to="/create-listing">
            <button className="px-4 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]">
              + Create New Listing
            </button>
          </Link>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* NEW: type filter pills (left) and the Status/Sort dropdowns
            (right) share one flex row on wider screens -- justify-between
            pushes them to opposite ends. flex-wrap means that once the
            screen narrows past a certain point, the dropdown group
            naturally drops to its own line below the pills, rather than
            needing a separate mobile-specific layout. */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          {/* Type filter, matching Explore's pattern -- kept as pills
              since this is the primary, most-used filter and already
              matches the established visual language across the app. */}
          <div className="flex gap-3 flex-wrap">
            {(["all", "offer", "want"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={
                  "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors " +
                  (typeFilter === t
                    ? "bg-[#8b5a2b] text-[#f7ecd8] border-[#8b5a2b]"
                    : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
                }
              >
                {t === "all" ? "All" : t === "offer" ? "Offers" : "Wants"}
              </button>
            ))}
          </div>

          {/* Status filter and Sort order, combined into one compact
              group of two dropdown selects instead of separate pill
              rows -- dropdowns read as "settings" rather than "primary
              navigation," which helps them feel visually distinct from
              the Type pills rather than competing with them. */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="statusFilter" className="text-sm text-[#7a6a58]">
                Status:
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "closed")}
                className="px-3 py-1.5 rounded-full text-sm font-semibold border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sortOrder" className="text-sm text-[#7a6a58]">
                Sort:
              </label>
              <select
                id="sortOrder"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                className="px-3 py-1.5 rounded-full text-sm font-semibold border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* NEW: date-range filter -- a preset dropdown, matching
            MyReviews.tsx's pattern. Presets (7/30 days) apply
            immediately, same as every other filter on this page --
            only "Custom range" needs an explicit Apply, since it
            depends on two separate date inputs both being set. */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <label htmlFor="datePreset" className="text-sm text-[#7a6a58]">
            Posted:
          </label>
          <select
            id="datePreset"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="px-3 py-1.5 rounded-full text-sm font-semibold border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] cursor-pointer"
          >
            <option value="all">All time</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>

          {datePreset === "custom" && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] text-sm focus:outline-none focus:border-[#8b5a2b]"
              />
              <span className="text-sm text-[#7a6a58]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] text-sm focus:outline-none focus:border-[#8b5a2b]"
              />
              <button
                onClick={applyCustomRange}
                disabled={!customStart || !customEnd}
                className="px-3 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22] disabled:opacity-50"
              >
                Apply
              </button>
            </>
          )}

          {datePreset !== "all" && (
            <button
              onClick={clearDateFilter}
              className="px-3 py-1.5 text-sm font-semibold border border-[#c9a06c] text-[#4a3620] rounded hover:bg-[#f1e5cc]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Same accent-box style as Home.tsx's About section (left
            border + light cream background) -- a first-time visitor has
            no way to know what "Active" vs. "Closed" actually does
            functionally, shown once here rather than repeated on every
            card, since the explanation is the same regardless of which
            listing you're looking at. */}
        <div
          className="pl-3 py-2 mb-4 rounded"
          style={{ borderLeft: "4px solid #8b5a2b", backgroundColor: "#f1e5cc" }}
        >
          <p className="text-sm" style={{ color: "#4a3620" }}>
            <span className="font-semibold" style={{ color: "#4a7c59" }}>Active</span> listings are visible on Explore and can receive swap requests. <span className="font-semibold" style={{ color: "#7a6a58" }}>Closed</span> listings are hidden until you reopen them.
          </p>
        </div>

        {listings.length === 0 && !error && (
          <p className="text-center text-[#7a6a58]">
            You haven't created any listings yet.
          </p>
        )}

        {/* NEW: friendly message when a filter combination matches
            nothing, distinct from "you have zero listings at all" above --
            otherwise a narrow filter could look identical to having no
            listings whatsoever. */}
        {listings.length > 0 && filteredListings.length === 0 && (
          <p className="text-center text-[#7a6a58]">
            No listings match the selected filters.
          </p>
        )}

        {/* NEW: a stacked single-column list, not a multi-column grid
            like Explore's -- deliberately different, since one card can
            expand into an inline edit form here (with full-width inputs
            and a tag editor), and CSS Grid would stretch every card in
            the same row to match the tallest one, making unrelated
            sibling cards look oddly tall while one is being edited. */}
        <div className="flex flex-col gap-4">
          {visibleListings.map((listing) => (
            <div key={listing._id} className="bg-white/60 backdrop-blur-sm rounded-lg p-5">
              {editingId === listing._id ? (
                // EDIT MODE
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block mb-1 font-semibold text-[#4a3620]">Title</label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b]"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 font-semibold text-[#4a3620]">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] resize-y"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 font-semibold text-[#4a3620]">Skill Tags</label>

                    {editSkillTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {editSkillTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-sm text-[#4a3620] bg-[#f1e5cc] border border-[#c9a06c] rounded-full px-3 py-1"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="font-bold text-[#8b5a2b] hover:text-[#7a4a22]"
                              aria-label={`Remove ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Type a skill and press Enter"
                        className="flex-1 px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-4 py-2 font-semibold border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-1">
                    <button
                      onClick={() => saveEdit(listing._id)}
                      className="px-4 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 font-semibold border border-[#c9a06c] text-[#4a3620] rounded hover:bg-[#f1e5cc]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // VIEW MODE
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-[#4a3620]">{listing.title}</h3>

                  {/* Type stays a solid rounded pill (green/orange), same
                      as Explore's cards. Status is now a plain dot +
                      label instead of a same-shaped pill -- previously
                      "offer" (green) and "active" (also green) looked
                      like the same category of information at a glance,
                      when they're actually two unrelated things (what
                      kind of listing it is, vs. whether it's currently
                      live). Different visual treatment makes that
                      distinction obvious without needing new colors. */}
                  <div className="flex items-center gap-3 flex-wrap">
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
                    <span className="flex items-center gap-1.5 text-sm text-[#4a3620]">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: listing.status === "active" ? "#4a7c59" : "#7a6a58" }}
                      />
                      {listing.status === "active" ? "Active" : "Closed"}
                    </span>
                  </div>

                  <p className="text-[#4a3620]">{listing.description}</p>

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

                  {/* NEW: posting date. */}
                  <p className="text-xs text-[#7a6a58]">
                    Posted on {new Date(listing.createdAt).toLocaleDateString()}
                  </p>

                  {/* NEW: icons added to Edit/Delete (plain inline SVGs,
                      no icon library). Delete moved to the right edge of
                      the row via ml-auto, and switched from an outlined
                      style to a solid red fill with white text/icon --
                      making it read as the one genuinely destructive
                      action on the card, distinct from Edit/Close which
                      are both reversible. */}
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {/* Edit is now solid (primary action) instead of
                        outlined, so it no longer looks like a twin of
                        Close/Reopen below it. */}
                    <button
                      onClick={() => startEditing(listing)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" strokeLinecap="round" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Edit
                    </button>

                    {/* NEW: this button's color now matches the status
                        it will produce, not a fixed neutral color -- so
                        it visually connects to the dot indicator above
                        instead of looking unrelated to it. "Close
                        Listing" (leads to Closed) uses the same muted
                        gray as the closed-state dot; "Reopen Listing"
                        (leads to Active) uses the same green as the
                        active-state dot. A matching small dot inside the
                        button reinforces the same connection. */}
                    <button
                      onClick={() => handleToggleStatus(listing)}
                      className={
                        "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border rounded " +
                        (listing.status === "active"
                          ? "border-[#7a6a58] text-[#7a6a58] hover:bg-[#e5e0d8]"
                          : "border-[#4a7c59] text-[#4a7c59] hover:bg-[#e3ede3]")
                      }
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: listing.status === "active" ? "#7a6a58" : "#4a7c59" }}
                      />
                      {listing.status === "active" ? "Close Listing" : "Reopen Listing"}
                    </button>

                    <button
                      onClick={() => handleDelete(listing._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded hover:bg-red-700 ml-auto"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" strokeLinecap="round" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* NEW: Load More button, same pattern as Explore.tsx -- only
            shown when there are more filtered/sorted results beyond
            what's currently visible. No network request happens here,
            just revealing more of the already-fetched listings array. */}
        {visibleCount < filteredListings.length && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => setVisibleCount((c) => c + 6)}
              className="px-6 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              Load More
            </button>
          </div>
        )}

        {/* NEW: end-of-list message, shown once every filtered/sorted
            result is already visible -- same pattern as Explore.tsx and
            Suggested Matches. */}
        {visibleListings.length > 0 && visibleCount >= filteredListings.length && (
          <p className="text-center text-[#7a6a58] mt-6">
            That's all your listings for this filter.
          </p>
        )}
      </div>
    </div>
  );
}

export default MyListings;