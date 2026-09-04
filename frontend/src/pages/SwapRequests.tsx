import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";

// UPDATED: status now includes the three new negotiation stages, plus
// the fields that track the negotiation itself (listingType,
// offeredListingIds, selectedListingId, statusUpdatedAt,
// rejectionReason).
interface Swap {
  _id: string;
  listingId: string;
  requesterId: string;
  receiverId: string;
  listingType: "offer" | "want";
  status: "pending" | "pending_share" | "pending_pick" | "pending_confirmation" | "accepted" | "rejected" | "completed" | "cancelled";
  offeredListingIds: string[];
  selectedListingId?: string;
  statusUpdatedAt: string;
  rejectionReason?: "declined" | "expired";
  createdAt: string;
  completedAt?: string;
}

interface Listing {
  _id: string;
  userId: string;
  title: string;
  type: "offer" | "want";
  status: string;
}

interface MyRating {
  swapId: string;
}

interface ContactInfo {
  name: string;
  email: string;
  phone?: string;
}

const EXPIRY_DAYS = 7;
const UNFINISHED_STATUSES: Swap["status"][] = ["pending", "pending_share", "pending_pick", "pending_confirmation"];

function SwapRequests() {
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<Swap[]>([]);
  const [outgoing, setOutgoing] = useState<Swap[]>([]);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");

  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});
  const [myOfferListings, setMyOfferListings] = useState<Listing[]>([]);

  const [ratedSwapIds, setRatedSwapIds] = useState<Set<string>>(new Set());
  const [ratingSwapId, setRatingSwapId] = useState<string | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  const [contactInfo, setContactInfo] = useState<Record<string, ContactInfo>>({});
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null);

  const [shareSelections, setShareSelections] = useState<Record<string, string[]>>({});
  const [pickSelections, setPickSelections] = useState<Record<string, string>>({});

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return;

    async function fetchEverything() {
      try {
        const [swapsRes, profileRes, listingsRes, myRatingsRes] = await Promise.all([
          axios.get("http://localhost:5000/api/swaps/mine", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("http://localhost:5000/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("http://localhost:5000/api/listings"),
          axios.get("http://localhost:5000/api/ratings/mine", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setIncoming(swapsRes.data.incoming);
        setOutgoing(swapsRes.data.outgoing);

        const myIdValue = profileRes.data._id;

        const titleMap: Record<string, string> = {};
        listingsRes.data.forEach((listing: Listing) => {
          titleMap[listing._id] = listing.title;
        });
        setListingTitles(titleMap);

        const mine = listingsRes.data.filter(
          (l: Listing) => l.userId === myIdValue && l.type === "offer"
        );
        setMyOfferListings(mine);

        const ratedIds = new Set<string>(myRatingsRes.data.map((r: MyRating) => r.swapId));
        setRatedSwapIds(ratedIds);
      } catch (err) {
        setError("Failed to load your swap requests.");
      }
    }

    fetchEverything();
  }, [token]);

  if (!token) return null;

  async function handleAction(swapId: string, path: string, body?: object) {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/swaps/${swapId}/${path}`,
        body || {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

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

  function toggleShareSelection(swapId: string, listingId: string) {
    setShareSelections((prev) => {
      const current = prev[swapId] || [];
      const next = current.includes(listingId)
        ? current.filter((id) => id !== listingId)
        : [...current, listingId];
      return { ...prev, [swapId]: next };
    });
  }

  function setPickSelection(swapId: string, listingId: string) {
    setPickSelections((prev) => ({ ...prev, [swapId]: listingId }));
  }

  function startRating(swapId: string) {
    setRatingSwapId(swapId);
    setRatingScore(0);
    setRatingComment("");
  }

  function cancelRating() {
    setRatingSwapId(null);
  }

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

  function renderStarInput() {
    return [1, 2, 3, 4, 5].map((n) => (
      <span
        key={n}
        onClick={() => setRatingScore(n)}
        className="cursor-pointer text-2xl"
        style={{ color: n <= ratingScore ? "#ffb400" : "#d9cdb8" }}
      >
        ★
      </span>
    ));
  }

  function isMyTurn(swap: Swap, isIncoming: boolean): boolean {
    switch (swap.status) {
      case "pending":
      case "pending_share":
        return isIncoming;
      case "pending_pick":
        return swap.listingType === "want" ? !isIncoming : isIncoming;
      case "pending_confirmation":
        return swap.listingType === "want" ? isIncoming : !isIncoming;
      default:
        return false;
    }
  }

  // NEW: figures out which of the two listings involved is the one I'll
  // TEACH vs. the one I'll LEARN, so the header can color-code them
  // using the same green/orange the app already uses for Offer/Want.
  function myTeachAndLearn(swap: Swap, isIncoming: boolean): { teachId: string; learnId: string } | null {
    if (!swap.selectedListingId) return null;

    const iLearnTheTarget =
      (swap.listingType === "want" && isIncoming) || (swap.listingType === "offer" && !isIncoming);

    return iLearnTheTarget
      ? { learnId: swap.listingId, teachId: swap.selectedListingId }
      : { teachId: swap.listingId, learnId: swap.selectedListingId };
  }

  function statusLabel(status: Swap["status"]): string {
    const labels: Record<Swap["status"], string> = {
      pending: "Pending",
      pending_share: "Awaiting Their List",
      pending_pick: "Awaiting a Pick",
      pending_confirmation: "Awaiting Confirmation",
      accepted: "Accepted",
      rejected: "Rejected",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return labels[status];
  }

  function statusBadge(status: Swap["status"]) {
    const styles: Record<Swap["status"], { bg: string; text: string }> = {
      pending: { bg: "#f4e3d0", text: "#b8590d" },
      pending_share: { bg: "#f4e3d0", text: "#b8590d" },
      pending_pick: { bg: "#f4e3d0", text: "#b8590d" },
      pending_confirmation: { bg: "#f4e3d0", text: "#b8590d" },
      accepted: { bg: "#e3ede3", text: "#4a7c59" },
      completed: { bg: "#4a7c59", text: "#ffffff" },
      rejected: { bg: "#fee2e2", text: "#b91c1c" },
      cancelled: { bg: "#e5e0d8", text: "#7a6a58" },
    };
    const s = styles[status];
    return (
      <span
        className="text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
        style={{ backgroundColor: s.bg, color: s.text }}
      >
        {statusLabel(status)}
      </span>
    );
  }

  function daysRemaining(swap: Swap): number {
    const msElapsed = Date.now() - new Date(swap.statusUpdatedAt).getTime();
    const msRemaining = EXPIRY_DAYS * 24 * 60 * 60 * 1000 - msElapsed;
    return Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  }

  function renderSwapCard(swap: Swap, isIncoming: boolean) {
    const myTurn = isMyTurn(swap, isIncoming);
    const listingName = listingTitles[swap.listingId] || "Listing no longer available";

    // NEW: once a pick has been made (pending_confirmation onward --
    // accepted, completed, cancelled, or rejected-after-pick), show BOTH
    // listings involved, not just the original target. Before a pick
    // exists (plain pending, pending_share), there's only one listing to
    // show, so this falls back to that alone.

    return (
      <div key={swap._id} className="bg-white/60 backdrop-blur-sm rounded-lg p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {(() => {
            const roles = myTeachAndLearn(swap, isIncoming);
            if (!roles) {
              return (
                <Link to={`/listing/${swap.listingId}`} className="font-semibold text-[#4a3620] hover:text-[#8b5a2b]">
                  {listingName}
                </Link>
              );
            }
            return (
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/listing/${roles.teachId}`}
                  className="text-sm font-semibold px-2 py-1 rounded"
                  style={{ backgroundColor: "#e3ede3", color: "#4a7c59" }}
                >
                  You teach: {listingTitles[roles.teachId] || "Listing no longer available"}
                </Link>
                <span className="text-[#a99b82]">↔</span>
                <Link
                  to={`/listing/${roles.learnId}`}
                  className="text-sm font-semibold px-2 py-1 rounded"
                  style={{ backgroundColor: "#f4e3d0", color: "#b8590d" }}
                >
                  You learn: {listingTitles[roles.learnId] || "Listing no longer available"}
                </Link>
              </div>
            );
          })()}
          {statusBadge(swap.status)}
        </div>

        {UNFINISHED_STATUSES.includes(swap.status) && (
          <p className="text-xs text-[#7a6a58]">
            {myTurn
              ? `Respond within ${daysRemaining(swap)} day${daysRemaining(swap) === 1 ? "" : "s"}, or this request will expire automatically.`
              : `Waiting on the other person — this expires automatically after ${EXPIRY_DAYS} days with no response.`}
          </p>
        )}

        {swap.status === "pending" && myTurn && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleAction(swap._id, "respond", { action: "accept" })}
              className="px-3 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              Accept
            </button>
            <button
              onClick={() => handleAction(swap._id, "respond", { action: "reject" })}
              className="px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reject
            </button>
          </div>
        )}

        {swap.status === "pending_share" && myTurn && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-[#4a3620]">Share Your Offer Listings</p>
            {myOfferListings.length === 0 ? (
              <p className="text-sm text-[#7a6a58]">
                You have no active offer listings to share.{" "}
                <Link to="/create-listing" className="font-semibold text-[#8b5a2b] hover:underline">
                  Create one first →
                </Link>
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {myOfferListings.map((l) => (
                  <label key={l._id} className="flex items-center gap-2 text-sm text-[#4a3620]">
                    <input
                      type="checkbox"
                      checked={(shareSelections[swap._id] || []).includes(l._id)}
                      onChange={() => toggleShareSelection(swap._id, l._id)}
                      className="accent-[#8b5a2b] w-4 h-4"
                    />
                    {l.title}
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() =>
                  handleAction(swap._id, "share", {
                    action: "share",
                    offeredListingIds: shareSelections[swap._id] || [],
                  })
                }
                disabled={(shareSelections[swap._id] || []).length === 0}
                className="px-3 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22] disabled:opacity-50"
              >
                Share Selected
              </button>
              <button
                onClick={() => handleAction(swap._id, "share", { action: "reject" })}
                className="px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {swap.status === "pending_pick" && myTurn && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-[#4a3620]">Choose What You'd Like to Learn</p>
            <div className="flex flex-col gap-1">
              {swap.offeredListingIds.map((listingId) => (
                <label key={listingId} className="flex items-center gap-2 text-sm text-[#4a3620]">
                  <input
                    type="radio"
                    name={`pick-${swap._id}`}
                    checked={pickSelections[swap._id] === listingId}
                    onChange={() => setPickSelection(swap._id, listingId)}
                    className="accent-[#8b5a2b] w-4 h-4"
                  />
                  {listingTitles[listingId] || "Listing no longer available"}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  handleAction(swap._id, "pick", {
                    action: "pick",
                    selectedListingId: pickSelections[swap._id],
                  })
                }
                disabled={!pickSelections[swap._id]}
                className="px-3 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22] disabled:opacity-50"
              >
                Confirm Pick
              </button>
              <button
                onClick={() => handleAction(swap._id, "pick", { action: "reject" })}
                className="px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {swap.status === "pending_confirmation" && myTurn && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-[#4a3620]">
              Confirm This Exchange
              {swap.selectedListingId && (
                <>
                  : teach{" "}
                  <span className="text-[#8b5a2b]">
                    {listingTitles[swap.selectedListingId] || "the selected listing"}
                  </span>
                </>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(swap._id, "confirm", { action: "accept" })}
                className="px-3 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
              >
                Accept
              </button>
              <button
                onClick={() => handleAction(swap._id, "confirm", { action: "reject" })}
                className="px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {swap.status === "rejected" && swap.rejectionReason && (
          <p className="text-sm text-[#7a6a58]">
            {swap.rejectionReason === "expired"
              ? "This request expired automatically after 7 days with no response."
              : "This request was declined."}
          </p>
        )}

        {swap.status === "accepted" && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleAction(swap._id, "complete")}
              className="px-3 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              Mark Complete
            </button>
            <button
              onClick={() => handleAction(swap._id, "cancel")}
              className="px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded hover:bg-red-700"
            >
              Cancel
            </button>
          </div>
        )}

        {(swap.status === "accepted" || swap.status === "completed") && (
          <div>
            {contactInfo[swap._id] ? (
              <div
                className="pl-3 py-2 rounded text-sm"
                style={{ borderLeft: "4px solid #8b5a2b", backgroundColor: "#f1e5cc", color: "#4a3620" }}
              >
                <p className="font-semibold">{contactInfo[swap._id].name}</p>
                <p>Email: {contactInfo[swap._id].email}</p>
                {contactInfo[swap._id].phone && <p>Phone: {contactInfo[swap._id].phone}</p>}
              </div>
            ) : (
              <button
                onClick={() => fetchContactInfo(swap._id)}
                disabled={loadingContactId === swap._id}
                className="px-3 py-1.5 text-sm font-semibold border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0] disabled:opacity-60"
              >
                {loadingContactId === swap._id ? "Loading..." : "Show Contact Info"}
              </button>
            )}
          </div>
        )}

        {swap.status === "completed" && !ratedSwapIds.has(swap._id) && (
          <div>
            {ratingSwapId === swap._id ? (
              <div className="flex flex-col gap-2">
                <div>{renderStarInput()}</div>
                <textarea
                  placeholder="Optional comment..."
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] resize-y placeholder:text-[#a99b82]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => submitRating(swap._id)}
                    className="px-3 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
                  >
                    Submit Rating
                  </button>
                  <button
                    onClick={cancelRating}
                    className="px-3 py-1.5 text-sm font-semibold border border-[#c9a06c] text-[#4a3620] rounded hover:bg-[#f1e5cc]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => startRating(swap._id)}
                className="px-3 py-1.5 text-sm font-semibold border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]"
              >
                Rate this exchange
              </button>
            )}
          </div>
        )}

        {swap.status === "completed" && ratedSwapIds.has(swap._id) && (
          <p className="text-sm italic text-[#7a6a58]">You've rated this exchange.</p>
        )}

        {UNFINISHED_STATUSES.includes(swap.status) && !myTurn && (
          <p className="text-sm text-[#7a6a58]">Waiting for the other person to respond.</p>
        )}
      </div>
    );
  }

  const visibleSwaps = activeTab === "incoming" ? incoming : outgoing;

  return (
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <h1
          className="mb-6 text-center"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            color: "#4a7c59",
            fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
          }}
        >
          Swap Requests
        </h1>

        {error && (
          <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab("incoming")}
            className={
              "px-5 py-2 rounded-full font-semibold border-2 transition-colors " +
              (activeTab === "incoming"
                ? "bg-[#4a7c59] text-white border-[#4a7c59]"
                : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
            }
          >
            Incoming ({incoming.length})
          </button>
          <button
            onClick={() => setActiveTab("outgoing")}
            className={
              "px-5 py-2 rounded-full font-semibold border-2 transition-colors " +
              (activeTab === "outgoing"
                ? "bg-[#4a7c59] text-white border-[#4a7c59]"
                : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
            }
          >
            Outgoing ({outgoing.length})
          </button>
        </div>

        {visibleSwaps.length === 0 && (
          <p className="text-center text-[#7a6a58]">
            {activeTab === "incoming" ? "No incoming requests." : "No outgoing requests."}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {visibleSwaps.map((swap) => renderSwapCard(swap, activeTab === "incoming"))}
        </div>
      </div>
    </div>
  );
}

export default SwapRequests;