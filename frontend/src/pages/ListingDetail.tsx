import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { API_URL } from "../config";

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

// NEW: minimal shape needed for the "which of my offer listings do I
// want to attach" selector (Case B) and for counting the target
// listing owner's offers (Case A's warning).
interface MyListing {
  _id: string;
  userId: string;
  title: string;
  type: "offer" | "want";
  status: string;
}

function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [listing, setListing] = useState<Listing | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");

  // NEW: the status the backend actually returned after sending the
  // request -- "Requested!" alone no longer says enough, since the
  // swap could now land on pending, pending_share, or pending_pick
  // depending on which case this is and whether there's anything to
  // negotiate with.
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  // NEW: Case B only (target listing is an "offer") -- my own active
  // offer listings, so I can choose which ones to attach when
  // requesting to learn from someone else's offer.
  const [myOfferListings, setMyOfferListings] = useState<MyListing[]>([]);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);

  // NEW: Case A only (target listing is a "want") -- how many active
  // offer listings the listing OWNER currently has, so we can warn the
  // sender upfront if there's nothing for the owner to actually share
  // back, per the agreed design.
  const [ownerOfferCount, setOwnerOfferCount] = useState<number | null>(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function fetchListing() {
      try {
        const response = await axios.get(`${API_URL}/api/listings/${id}`);
        setListing(response.data);

        if (token) {
          const profileRes = await axios.get(`${API_URL}/api/auth/me`, {
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

  // NEW: once we know the listing and who I am, fetch whatever extra
  // data this specific case needs -- my own offer listings for Case B,
  // or the owner's offer count for Case A. Only runs once both listing
  // and myId are available, and only if this isn't my own listing.
  useEffect(() => {
    if (!listing || !myId || listing.userId._id === myId) return;

    async function fetchCaseData() {
      try {
        if (listing!.type === "offer") {
          // CASE B: I need to see my OWN active offer listings, to pick
          // which ones to attach when requesting to learn this.
          const res = await axios.get(`${API_URL}/api/listings`);
          const mine = res.data.filter(
            (l: MyListing) => l.userId === myId && l.type === "offer"
          );
          setMyOfferListings(mine);
        } else {
          // CASE A: I need to know if the OWNER has anything to trade
          // back, so I can warn the sender (myself) before sending if not.
          const res = await axios.get(
            `${API_URL}/api/users/${listing!.userId._id}/profile`
          );
          const ownerOffers = (res.data.activeListings || []).filter(
            (l: MyListing) => l.type === "offer"
          );
          setOwnerOfferCount(ownerOffers.length);
        }
      } catch (err) {
        // Non-critical -- if this fails, the warning/selector just
        // won't show, but the core request flow still works via the
        // backend's own validation either way.
      }
    }

    fetchCaseData();
  }, [listing, myId]);

  function toggleOfferSelection(listingId: string) {
    setSelectedOfferIds((prev) =>
      prev.includes(listingId) ? prev.filter((id) => id !== listingId) : [...prev, listingId]
    );
  }

  // UPDATED: now branches by case. Case B sends selectedOfferIds along
  // with the request; Case A sends just the listingId, same as before.
  async function handleRequestSwap() {
    if (!token || !listing) {
      setRequestError("You must be logged in to request a swap.");
      return;
    }

    try {
      const body =
        listing.type === "offer"
          ? { listingId: listing._id, offeredListingIds: selectedOfferIds }
          : { listingId: listing._id };

      const response = await axios.post(`${API_URL}/api/swaps`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setRequested(true);
      setRequestStatus(response.data.status);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setRequestError(err.response.data.error || "Failed to send swap request.");
      } else {
        setRequestError("Something went wrong.");
      }
    }
  }

  // NEW: translates whatever status the backend returned into a
  // message that actually explains what happens next -- "Requested!"
  // alone no longer covers every case.
  function requestStatusMessage(): string {
    switch (requestStatus) {
      case "pending_share":
        return "Request sent! They'll share their offer listings with you next.";
      case "pending_pick":
        return "Request sent! They'll pick what they'd like to learn from your offered skills.";
      case "pending":
      default:
        return "Request sent! They'll get a simple accept/reject option.";
    }
  }

  if (error) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        <Navbar />
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
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
          <p className="text-center text-[#7a6a58]">Loading...</p>
        </div>
      </div>
    );
  }

  const isOwnListing = myId === listing.userId._id;

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

          <div className="flex flex-col gap-0.5">
            <p className="text-[#4a3620]">
              Posted by{" "}
              <Link to={`/profile/${listing.userId._id}`} className="font-semibold text-[#8b5a2b] hover:underline">
                {listing.userId.name}
              </Link>
            </p>
            <p className="text-sm text-[#7a6a58]">
              Posted on {new Date(listing.createdAt).toLocaleDateString()}
            </p>
          </div>

          <p className="text-[#4a3620] leading-relaxed" style={{ marginTop: "8px" }}>
            {listing.description}
          </p>

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

          {!isOwnListing && myId && requested && (
            <div
              className="mt-2 pl-3 py-2 rounded text-sm"
              style={{ borderLeft: "4px solid #4a7c59", backgroundColor: "#e3ede3", color: "#4a3620" }}
            >
              {requestStatusMessage()}
            </div>
          )}

          {!isOwnListing && myId && !requested && listing.type === "offer" && (
            <div className="mt-2 flex flex-col gap-2">
              {myOfferListings.length > 0 ? (
                <>
                  <p className="font-semibold text-[#4a3620]">
                    Select which of your offer listings you'd like to offer in return:
                  </p>
                  <div className="flex flex-col gap-1">
                    {myOfferListings.map((l) => (
                      <label key={l._id} className="flex items-center gap-2 text-[#4a3620]">
                        <input
                          type="checkbox"
                          checked={selectedOfferIds.includes(l._id)}
                          onChange={() => toggleOfferSelection(l._id)}
                          className="accent-[#8b5a2b] w-4 h-4"
                        />
                        {l.title}
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <div
                  className="pl-3 py-2 rounded text-sm"
                  style={{ borderLeft: "4px solid #8b5a2b", backgroundColor: "#f1e5cc", color: "#4a3620" }}
                >
                  You have no active offer listings to attach. If you send this request, they'll get a simple
                  accept/reject option instead of the full negotiation.{" "}
                  <Link to="/create-listing" className="font-semibold text-[#8b5a2b] hover:underline">
                    Create one first →
                  </Link>
                </div>
              )}
            </div>
          )}

          {!isOwnListing && myId && !requested && listing.type === "want" && ownerOfferCount === 0 && (
            <div
              className="mt-2 pl-3 py-2 rounded text-sm"
              style={{ borderLeft: "4px solid #8b5a2b", backgroundColor: "#f1e5cc", color: "#4a3620" }}
            >
              This person currently has no offer listings to trade back. If you send this request, they'll get a
              simple accept/reject option instead of the full negotiation.
            </div>
          )}

          {!isOwnListing && myId && !requested && requestError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">
              {requestError}
            </p>
          )}

          {!isOwnListing && myId && !requested && (
            <button
              onClick={handleRequestSwap}
              className="mt-2 self-start px-6 py-2 font-semibold rounded bg-[#8b5a2b] text-[#f7ecd8] hover:bg-[#7a4a22] transition-colors"
            >
              Request Swap
            </button>
          )}

          {!isOwnListing && !myId && (
            <p className="text-[#4a3620]" style={{ marginTop: "12px" }}>
              <Link to="/login" className="font-semibold text-[#8b5a2b] hover:underline">
                Log in
              </Link>{" "}
              to request a swap.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ListingDetail;