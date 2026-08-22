import { useState, useEffect } from "react";
import axios from "axios";

interface Swap {
  _id: string;
  listingId: string;
  requesterId: string;
  receiverId: string;
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  createdAt: string;
  completedAt?: string;
}

interface Listing {
  _id: string;
  title: string;
}

// NEW: shape of one rating the logged-in user has already given --
// only need swapId here, just to build the "already rated" lookup.
interface MyRating {
  swapId: string;
}

// NEW: shape of the contact info returned by GET /api/swaps/:id/contact
interface ContactInfo {
  name: string;
  email: string;
  phone?: string;
}

function SwapRequests() {
  const [incoming, setIncoming] = useState<Swap[]>([]);
  const [outgoing, setOutgoing] = useState<Swap[]>([]);
  const [error, setError] = useState("");

  // Maps a listing's _id to its title, so we can show "Guitar basics"
  // instead of a raw ObjectId string on each swap card. Built up
  // after fetching the swaps, since we only know which listings we
  // actually need titles for once we have the swap list in hand.
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});

  // NEW: which swap _ids the logged-in user has ALREADY rated --
  // fetched upfront on page load, so "Rate this exchange" is
  // correctly hidden from the very first render, not just after a
  // same-session submission (a refresh shouldn't bring the button back).
  const [ratedSwapIds, setRatedSwapIds] = useState<Set<string>>(new Set());

  // NEW: tracks which swap's rating form is currently open, same
  // single-open-form pattern as MyListings.tsx's editingId.
  const [ratingSwapId, setRatingSwapId] = useState<string | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  // NEW: caches fetched contact info per swap _id, so clicking
  // "Show Contact Info" twice doesn't re-fetch -- same caching idea
  // as listingTitles, just built up on-demand instead of all at once.
  const [contactInfo, setContactInfo] = useState<Record<string, ContactInfo>>({});

  // NEW: tracks which swap's contact fetch is currently in flight,
  // so we can show "Loading..." and avoid double-clicks firing two requests.
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function fetchSwaps() {
      try {
        const response = await axios.get("http://localhost:5000/api/swaps/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIncoming(response.data.incoming);
        setOutgoing(response.data.outgoing);

        // Gather every unique listingId across both incoming and
        // outgoing swaps, then fetch all listings once and build a
        // lookup table -- avoids fetching the same listing's title
        // multiple times if it appears in several swaps.
        const allSwaps = [...response.data.incoming, ...response.data.outgoing];
        const uniqueListingIds = [...new Set(allSwaps.map((s: Swap) => s.listingId))];

        const listingsRes = await axios.get("http://localhost:5000/api/listings");
        const titleMap: Record<string, string> = {};
        listingsRes.data.forEach((listing: Listing) => {
          if (uniqueListingIds.includes(listing._id)) {
            titleMap[listing._id] = listing.title;
          }
        });
        setListingTitles(titleMap);

        // NEW: fetch which swaps this user has already rated, so the
        // rating button correctly stays hidden across page reloads.
        const myRatingsRes = await axios.get("http://localhost:5000/api/ratings/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const ratedIds = new Set<string>(
          myRatingsRes.data.map((r: MyRating) => r.swapId)
        );
        setRatedSwapIds(ratedIds);
      } catch (err) {
        setError("Failed to load your swap requests.");
      }
    }

    fetchSwaps();
  }, [token]);

  // Shared helper for accept/reject/complete/cancel -- all four
  // backend actions follow the same shape (PUT to a specific sub-path,
  // optionally with a body), so one function handles all of them
  // rather than writing four nearly-identical functions.
  async function handleAction(swapId: string, path: string, body?: object) {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/swaps/${swapId}/${path}`,
        body || {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update just this one swap in whichever list it belongs to,
      // using the server's response as the new source of truth --
      // same "update in place" pattern as MyListings.tsx's edit.
      const updateList = (list: Swap[]) =>
        list.map((s) => (s._id === swapId ? response.data : s));

      setIncoming((prev) => updateList(prev));
      setOutgoing((prev) => updateList(prev));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Action failed.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  // NEW: opens the rating form for a specific swap, resetting any
  // leftover values from a previous rating attempt.
  function startRating(swapId: string) {
    setRatingSwapId(swapId);
    setRatingScore(0);
    setRatingComment("");
  }

  function cancelRating() {
    setRatingSwapId(null);
  }

  // NEW: submits the rating. Note we only send swapId, score, and
  // comment -- the backend derives WHO is being rated automatically
  // from the swap record itself, so the frontend never needs to
  // figure that out or send it.
  async function submitRating(swapId: string) {
    if (ratingScore === 0) {
      setError("Please select a star rating before submitting.");
      return;
    }

    try {
      await axios.post(
        "http://localhost:5000/api/ratings",
        { swapId, score: ratingScore, comment: ratingComment || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Mark this swap as rated so the button disappears immediately,
      // and close the form.
      setRatedSwapIds((prev) => new Set(prev).add(swapId));
      setRatingSwapId(null);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to submit rating.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  // NEW: fetches the other participant's contact info for a given swap,
  // on demand -- only called when the user clicks "Show Contact Info",
  // not automatically for every swap on page load (that would be a lot
  // of unnecessary requests for swaps the user never looks at closely).
  async function fetchContactInfo(swapId: string) {
    setLoadingContactId(swapId);
    try {
      const response = await axios.get(
        `http://localhost:5000/api/swaps/${swapId}/contact`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setContactInfo((prev) => ({ ...prev, [swapId]: response.data }));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to load contact info.");
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoadingContactId(null);
    }
  }

  // NEW: renders 5 clickable stars. Filled up to whatever the
  // currently selected score is, clicking a star sets the score to
  // that star's position (1-5).
  function renderStarInput() {
    return [1, 2, 3, 4, 5].map((n) => (
      <span
        key={n}
        onClick={() => setRatingScore(n)}
        style={{
          cursor: "pointer",
          fontSize: "24px",
          color: n <= ratingScore ? "#ffb400" : "#ccc",
        }}
      >
        ★
      </span>
    ));
  }

  // Renders one swap card, with whatever action buttons make sense
  // for its current status and whether the viewer is the receiver
  // (can accept/reject a pending one) or a participant in general
  // (can complete/cancel an accepted one, from either side).
  function renderSwapCard(swap: Swap, isIncoming: boolean) {
    return (
      <div key={swap._id} style={{ border: "1px solid gray", padding: "10px", marginBottom: "10px" }}>
        <p><strong>Listing:</strong> {listingTitles[swap.listingId] || swap.listingId}</p>
        <p><strong>Status:</strong> {swap.status}</p>

        {/* Only the receiver sees Accept/Reject, and only while pending */}
        {isIncoming && swap.status === "pending" && (
          <>
            <button onClick={() => handleAction(swap._id, "respond", { action: "accept" })}>
              Accept
            </button>
            <button onClick={() => handleAction(swap._id, "respond", { action: "reject" })}>
              Reject
            </button>
          </>
        )}

        {/* Either side sees Complete/Cancel, but only once accepted */}
        {swap.status === "accepted" && (
          <>
            <button onClick={() => handleAction(swap._id, "complete")}>Mark Complete</button>
            <button onClick={() => handleAction(swap._id, "cancel")}>Cancel</button>
          </>
        )}

        {/* NEW: contact info -- available once accepted, stays visible after
            completion too. Fetched on demand, cached in state once loaded. */}
        {(swap.status === "accepted" || swap.status === "completed") && (
          <div style={{ marginTop: "8px" }}>
            {contactInfo[swap._id] ? (
              <div>
                <p><strong>Contact:</strong> {contactInfo[swap._id].name}</p>
                <p>Email: {contactInfo[swap._id].email}</p>
                {contactInfo[swap._id].phone && <p>Phone: {contactInfo[swap._id].phone}</p>}
              </div>
            ) : (
              <button
                onClick={() => fetchContactInfo(swap._id)}
                disabled={loadingContactId === swap._id}
              >
                {loadingContactId === swap._id ? "Loading..." : "Show Contact Info"}
              </button>
            )}
          </div>
        )}

        {/* NEW: rating section -- only for completed swaps, and only
            if this user hasn't already rated this one. */}
        {swap.status === "completed" && !ratedSwapIds.has(swap._id) && (
          <div style={{ marginTop: "8px" }}>
            {ratingSwapId === swap._id ? (
              // Rating form is open for THIS swap
              <div>
                <div>{renderStarInput()}</div>
                <textarea
                  placeholder="Optional comment..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                />
                <button onClick={() => submitRating(swap._id)}>Submit Rating</button>
                <button onClick={cancelRating}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => startRating(swap._id)}>Rate this exchange</button>
            )}
          </div>
        )}

        {/* NEW: simple confirmation once rated, so the card doesn't
            just go silent after a completed swap. */}
        {swap.status === "completed" && ratedSwapIds.has(swap._id) && (
          <p style={{ marginTop: "8px", fontStyle: "italic" }}>You've rated this exchange.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2>Swap Requests</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <h3>Incoming (requests for your listings)</h3>
      {incoming.length === 0 && <p>No incoming requests.</p>}
      {incoming.map((swap) => renderSwapCard(swap, true))}

      <h3>Outgoing (your requests to others)</h3>
      {outgoing.length === 0 && <p>No outgoing requests.</p>}
      {outgoing.map((swap) => renderSwapCard(swap, false))}
    </div>
  );
}

export default SwapRequests;