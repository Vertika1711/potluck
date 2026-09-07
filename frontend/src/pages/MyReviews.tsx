import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { getAvatarSrc } from "../utils/avatar";
import { API_URL } from "../config";

interface Rating {
  _id: string;
  raterId: { _id: string; name: string; avatarId?: number } | null;
  score: number;
  comment?: string;
  createdAt: string;
  swapId?: {
    _id: string;
    listingType: "offer" | "want";
    requesterId: string;
    receiverId: string;
    listingId: { _id: string; title: string } | null;
    selectedListingId?: { _id: string; title: string } | null;
  };
}

type DatePreset = "all" | "7days" | "30days" | "custom";

function MyReviews() {
  const navigate = useNavigate();

  const [myId, setMyId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [draftPreset, setDraftPreset] = useState<DatePreset>("all");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");

  const [appliedStart, setAppliedStart] = useState<string | undefined>(undefined);
  const [appliedEnd, setAppliedEnd] = useState<string | undefined>(undefined);

  const token = localStorage.getItem("token");

  function formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

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
      return { start: draftStart || undefined, end: draftEnd || undefined };
    }

    return { start: undefined, end: undefined };
  }

  function applyFilter() {
    const { start, end } = computeRangeFromPreset(draftPreset);
    setAppliedStart(start);
    setAppliedEnd(end);
    setPage(1);
  }

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
        let idToUse = myId;
        if (!idToUse) {
          const meRes = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          idToUse = meRes.data._id;
          setMyId(idToUse);
        }

        let url = `${API_URL}/api/ratings/user/${idToUse}?page=${page}`;
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

  function renderStars(score: number) {
    return [1, 2, 3, 4, 5].map((n) => (
      <span key={n} className="text-lg" style={{ color: n <= score ? "#ffb400" : "#d9cdb8" }}>
        ★
      </span>
    ));
  }

  function myTeachAndLearnForRating(
    rating: Rating
  ): { teachTitle: string; learnTitle: string } | { single: { title: string; role: "teach" | "learn" } } | null {
    const swap = rating.swapId;
    if (!swap || !swap.listingId || !myId) return null;

    const isRequester = swap.requesterId === myId;
    const iLearnTheTarget =
      (swap.listingType === "want" && !isRequester) || (swap.listingType === "offer" && isRequester);

    if (swap.selectedListingId) {
      return iLearnTheTarget
        ? { learnTitle: swap.listingId.title, teachTitle: swap.selectedListingId.title }
        : { teachTitle: swap.listingId.title, learnTitle: swap.selectedListingId.title };
    }

    return {
      single: {
        title: swap.listingId.title,
        role: iLearnTheTarget ? "learn" : "teach",
      },
    };
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
            const teachLearn = myTeachAndLearnForRating(rating);

            return (
              <div key={rating._id} className="bg-white/60 backdrop-blur-sm rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
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

                {teachLearn && "single" in teachLearn && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-semibold rounded-full px-2 py-0.5"
                      style={
                        teachLearn.single.role === "teach"
                          ? { backgroundColor: "#e3ede3", color: "#4a7c59" }
                          : { backgroundColor: "#f4e3d0", color: "#b8590d" }
                      }
                    >
                      {teachLearn.single.role === "teach" ? "You taught: " : "You learned: "}
                      {teachLearn.single.title}
                    </span>
                  </div>
                )}

                {teachLearn && "teachTitle" in teachLearn && (
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
              </div>
            );
          })}
        </div>

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