import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

interface Rating {
  _id: string;
  raterId: { _id: string; name: string } | null;
  score: number;
  comment?: string;
  createdAt: string;
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

  if (loading) return <p style={{ textAlign: "center", marginTop: "60px" }}>Loading...</p>;
  if (error) return <p style={{ textAlign: "center", marginTop: "60px" }}>{error}</p>;

  return (
    <div style={{ maxWidth: "500px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <Link to="/profile">← Back to Profile</Link>
      <h1>My Reviews</h1>

      {/* Date-range filter -- a preset dropdown, with two extra date
          inputs that only appear when "Custom range" is selected.
          Nothing takes effect until "Apply Filter" is clicked. */}
      <div style={{ marginBottom: "16px" }}>
        <label>Show reviews from: </label>
        <select
          value={draftPreset}
          onChange={(e) => setDraftPreset(e.target.value as DatePreset)}
        >
          <option value="all">All time</option>
          <option value="7days">Last 7 days</option>
          <option value="30days">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>

        {draftPreset === "custom" && (
          <div style={{ marginTop: "8px" }}>
            <input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} />
            {" to "}
            <input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} />
          </div>
        )}

        <div style={{ marginTop: "8px" }}>
          <button onClick={applyFilter}>Apply Filter</button>
          <button onClick={clearFilter}>Clear</button>
        </div>
      </div>

      {ratings.length === 0 && <p>No reviews match this range.</p>}
      {ratings.map((rating) => (
        <div key={rating._id} style={{ border: "1px solid gray", padding: "10px", marginBottom: "8px" }}>
          <p><strong>{rating.raterId?.name || "Deleted User"}</strong> — {"★".repeat(rating.score)}{"☆".repeat(5 - rating.score)}</p>
          {rating.comment && <p>{rating.comment}</p>}
          <p style={{ fontSize: "12px", color: "gray" }}>{new Date(rating.createdAt).toLocaleDateString()}</p>
          {/* No helpful-vote button here -- these are reviews ABOUT me,
              and I can't mark my own reviews as helpful (same rule as
              the "My Reviews" section that used to live on Profile.tsx). */}
        </div>
      ))}

      {totalPages > 1 && (
        <div style={{ marginTop: "16px" }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Prev
          </button>
          <span style={{ margin: "0 10px" }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </button>
        </div>
      )}

      {ratings.length > 0 && page === totalPages && (
        <p style={{ textAlign: "center", color: "gray", marginTop: "12px" }}>
          You've reached the end — no more reviews to show.
        </p>
      )}
    </div>
  );
}

export default MyReviews;