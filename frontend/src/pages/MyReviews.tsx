import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { getAvatarSrc } from "../utils/avatar";

interface Rating {
  _id: string;
  raterId: { _id: string; name: string; avatarId?: number } | null;
  score: number;
  comment?: string;
  createdAt: string;
  // NEW: populated swap/listing info, used to derive which skill was
  // taught vs. learned in the exchange this review is about. Optional
  // since older data or an edge case could theoretically lack it.
  swapId?: {
    _id: string;
    listingType: "offer" | "want";
    requesterId: string;
    receiverId: string;
    listingId: { _id: string; title: string } | null;
    selectedListingId?: { _id: string; title: string } | null;
  };
}

// The date-range preset options -- "custom" reveals two extra date
// inputs, the other three compute their own start/end automatically.
type DatePreset = "all" | "7days" | "30days" | "custom";

function MyReviews() {
  const navigate = useNavigate();

  const [myId, setMyId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // "Draft" filter state -- what the user is currently selecting in
  // the dropdown/date inputs, BEFORE clicking Apply. Kept separate
  // from the "applied" filter actually sent to the backend, per the
  // decision that filtering only happens on an explicit Apply click,
  // not live as the user picks options (same principle as Profile.tsx's
  // edit-mode -- nothing takes effect until you deliberately save/apply).
  const [draftPreset, setDraftPreset] = useState<DatePreset>("all");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");

  // "Applied" filter -- what's ACTUALLY used in the API call. Starts
  // as undefined (no filter, all reviews).
  const [appliedStart, setAppliedStart] = useState<string | undefined>(undefined);
  const [appliedEnd, setAppliedEnd] = useState<string | undefined>(undefined);

  const token = localStorage.getItem("token");

  // Formats a Date object as "YYYY-MM-DD", matching what the backend
  // expects for startDate/endDate query params.
  function formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  // Turns a preset selection into concrete start/end date strings.
  // Returns { start: undefined, end: undefined } for "all" -- no filter.
  function computeRangeFromPreset(preset: DatePreset): { start?: string; end?: string } {
    const today = new Date();

    if (preset === "7days") {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      return { start: formatDate(sevenDaysAgo), end: formatDate(today) };
    }

    if (preset === "30days") {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return { start: formatDate(thirtyDaysAgo), end: formatDate(today) };
    }

    if (preset === "custom") {
      // Custom dates come directly from the draftStart/draftEnd inputs,
      // not computed here -- handled by the caller.
      return { start: draftStart || undefined, end: draftEnd || undefined };
    }

    // preset === "all"
    return { start: undefined, end: undefined };
  }

  function applyFilter() {
    const { start, end } = computeRangeFromPreset(draftPreset);
    setAppliedStart(start);
    setAppliedEnd(end);
    setPage(1); // any new filter starts back at page 1 -- the old page
    // number might not even exist in the newly filtered result set.
  }

  // Resets everything back to "all time" immediately -- unlike normal
  // filter changes, clearing is a reset action, not a new selection to
  // review before applying, so this deliberately skips the Apply step.
  function clearFilter() {
    setDraftPreset("all");
    setDraftStart("");
    setDraftEnd("");
    setAppliedStart(undefined);
    setAppliedEnd(undefined);
    setPage(1);
  }

  useEffect(() => {
    async function loadEverything() {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        // Need my own id first, same as Profile.tsx.
        let idToUse = myId;
        if (!idToUse) {
          const meRes = await axios.get("http://localhost:5000/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          idToUse = meRes.data._id;
          setMyId(idToUse);
        }

        let url = `http://localhost:5000/api/ratings/user/${idToUse}?page=${page}`;
        if (appliedStart && appliedEnd) {
          url += `&startDate=${appliedStart}&endDate=${appliedEnd}`;
        }

        const ratingsRes = await axios.get(url);
        setRatings(ratingsRes.data.ratings);
        setTotalPages(ratingsRes.data.totalPages);
      } catch (err) {
        setError("Failed to load your reviews.");
      } finally {
        setLoading(false);
      }
    }

    loadEverything();
  }, [token, navigate, page, appliedStart, appliedEnd, myId]);

  // NEW: read-only 5-star display, same pattern as PublicProfile.tsx's
  // renderStars -- not clickable, since a submitted review's score
  // can't be changed by the person it's about.
  function renderStars(score: number) {
    return [1, 2, 3, 4, 5].map((n) => (
      <span key={n} className="text-lg" style={{ color: n <= score ? "#ffb400" : "#d9cdb8" }}>
        ★
      </span>
    ));
  }

  // NEW: derives which listing I (the person being reviewed, myId) was
  // teaching vs. learning in this rating's underlying swap -- same core
  // logic as SwapRequests.tsx's myTeachAndLearn, adapted to work from a
  // rating's perspective instead of a live swap card. "isRequester"
  // here means *I* was the one who originally sent the swap request.
  function myTeachAndLearnForRating(rating: Rating): { teachTitle: string; learnTitle: string } | null {
    const swap = rating.swapId;
    if (!swap || !swap.selectedListingId || !swap.listingId || !myId) return null;

    const isRequester = swap.requesterId === myId;
    const iLearnTheTarget =
      (swap.listingType === "want" && !isRequester) || (swap.listingType === "offer" && isRequester);

    return iLearnTheTarget
      ? { learnTitle: swap.listingId.title, teachTitle: swap.selectedListingId.title }
      : { teachTitle: swap.listingId.title, learnTitle: swap.selectedListingId.title };
  }

  if (loading) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        <Navbar />
        <p className="text-center text-[#7a6a58] mt-16">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        <Navbar />
        <p className="text-center text-red-700 mt-16">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        {/* Same block-button back pattern as ListingDetail.tsx/
            CreateListing.tsx, but a fixed destination (not navigate(-1))
            since this is a dedicated sub-page of Profile specifically
            (decisions-log.md #20's flat-route pattern), not a page
            reachable from several different places. */}
        <button
          onClick={() => navigate(-1)}
          className="block mb-6 px-4 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
        >
          ← Back
        </button>

        <h1
          className="mb-6 text-center"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            color: "#4a7c59",
            fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
          }}
        >
          My Reviews
        </h1>

        {/* Date-range filter -- a preset dropdown, with two extra date
            inputs that only appear when "Custom range" is selected.
            Nothing takes effect until "Apply Filter" is clicked.
            Restyled to match the app's input/select/button language,
            same visual family as MyListings.tsx's Status/Sort dropdowns. */}
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="datePreset" className="text-sm text-[#7a6a58]">
              Show reviews from:
            </label>
            <select
              id="datePreset"
              value={draftPreset}
              onChange={(e) => setDraftPreset(e.target.value as DatePreset)}
              className="px-3 py-1.5 rounded-full text-sm font-semibold border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] cursor-pointer"
            >
              <option value="all">All time</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
          </div>

          {draftPreset === "custom" && (
            <div className="flex items-center gap-2 flex-wrap mt-3">
              <input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="px-3 py-1.5 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] text-sm focus:outline-none focus:border-[#8b5a2b]"
              />
              <span className="text-sm text-[#7a6a58]">to</span>
              <input
                type="date"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="px-3 py-1.5 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] text-sm focus:outline-none focus:border-[#8b5a2b]"
              />
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={applyFilter}
              className="px-4 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              Apply Filter
            </button>
            <button
              onClick={clearFilter}
              className="px-4 py-1.5 text-sm font-semibold border border-[#c9a06c] text-[#4a3620] rounded hover:bg-[#f1e5cc]"
            >
              Clear
            </button>
          </div>
        </div>

        {ratings.length === 0 && (
          <p className="text-center text-[#7a6a58] mb-6">No reviews match this range.</p>
        )}

        <div className="flex flex-col gap-3">
          {ratings.map((rating) => {
            // NEW: computed once per card -- null if the swap data
            // wasn't available for some reason, in which case the
            // skill-pair line is simply omitted rather than shown broken.
            const teachLearn = myTeachAndLearnForRating(rating);

            return (
              <div key={rating._id} className="bg-white/60 backdrop-blur-sm rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {/* Reviewer's avatar shown beside their name, same
                      getAvatarSrc() used everywhere else in the app --
                      falls back to that reviewer's own deterministic
                      default if they never picked one. */}
                  <div className="flex items-center gap-2">
                    {rating.raterId && (
                      <img
                        src={getAvatarSrc(rating.raterId._id, rating.raterId.avatarId)}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                        style={{ border: "2px solid #c9a06c" }}
                      />
                    )}
                    <p className="font-semibold text-[#4a3620]">
                      {rating.raterId?.name || "Deleted User"}
                    </p>
                  </div>
                  <div>{renderStars(rating.score)}</div>
                </div>

                {/* UPDATED: which skill was taught vs. learned, now as
                    small pill badges (matching the tag-chip visual
                    language used throughout the app) instead of plain
                    inline text -- reads as distinct metadata rather
                    than a floating sentence competing with the comment
                    text below it. */}
                {teachLearn && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-semibold rounded-full px-2 py-0.5"
                      style={{ backgroundColor: "#e3ede3", color: "#4a7c59" }}
                    >
                      {teachLearn.teachTitle}
                    </span>
                    <span className="text-[#a99b82]">↔</span>
                    <span
                      className="text-xs font-semibold rounded-full px-2 py-0.5"
                      style={{ backgroundColor: "#f4e3d0", color: "#b8590d" }}
                    >
                      {teachLearn.learnTitle}
                    </span>
                  </div>
                )}

                {rating.comment && <p className="text-[#4a3620]">{rating.comment}</p>}

                <p className="text-xs text-[#a99b82]">
                  {new Date(rating.createdAt).toLocaleDateString()}
                </p>

                {/* No helpful-vote button here -- these are reviews ABOUT me,
                    and I can't mark my own reviews as helpful (same rule as
                    the "My Reviews" section that used to live on Profile.tsx). */}
              </div>
            );
          })}
        </div>

        {/* Restyled Prev/Next/"Page X of Y", same treatment as
            PublicProfile.tsx's pagination -- solid brown when enabled,
            faded when disabled at either boundary. */}
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

export default MyReviews;