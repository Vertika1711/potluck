import { useState, useEffect } from "react";
import axios from "axios";

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

function BrowseListings() {
  // Starts as an empty array -- gets filled in once the fetch below completes
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState("");

  // NEW: tracks the logged-in user's own ID, so we can hide the
  // "Request Swap" button on listings they own themselves.
  // Stays null if the person isn't logged in (browsing is public).
  const [myId, setMyId] = useState<string | null>(null);

  // NEW: tracks which listing IDs a swap request was JUST sent for,
  // so the button can show "Requested!" instead of staying clickable
  // and letting someone accidentally send duplicate requests.
  const [requestedIds, setRequestedIds] = useState<string[]>([]);

  const token = localStorage.getItem("token");

  // useEffect with an empty dependency array [] means:
  // "run this once, right when the component first appears on screen."
  // Same pattern as Profile.tsx fetching /me on load.
  useEffect(() => {
    async function fetchListings() {
      try {
        // No Authorization header needed here -- this route is public,
        // matching how we built GET /api/listings on the backend.
        const response = await axios.get("http://localhost:5000/api/listings");
        setListings(response.data);

        // NEW: only try to fetch "who am I" if a token actually exists --
        // browsing works fine while logged out, we just won't know an
        // identity to compare against, so myId simply stays null.
        if (token) {
          const profileRes = await axios.get("http://localhost:5000/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMyId(profileRes.data._id);
        }
      } catch (err) {
        setError("Failed to load listings.");
      }
    }

    fetchListings();
  }, [token]);

  // NEW: sends a swap request on a specific listing.
  async function handleRequestSwap(listingId: string) {
    if (!token) {
      setError("You must be logged in to request a swap.");
      return;
    }

    try {
      await axios.post(
        "http://localhost:5000/api/swaps",
        { listingId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Adds this listing's ID to our "already requested" list,
      // which swaps the button to a disabled "Requested!" state below.
      setRequestedIds((prev) => [...prev, listingId]);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to send swap request.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  return (
    <div>
      <h2>Browse Listings</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* .map() turns each listing object into a visible block on the page.
          "key" is required by React whenever you render a list -- it uses
          the listing's unique _id to keep track of each item efficiently. */}
      {listings.map((listing) => (
        <div key={listing._id} style={{ border: "1px solid gray", padding: "10px", marginBottom: "10px" }}>
          <h3>{listing.title}</h3>
          <p>{listing.description}</p>
          <p><strong>Type:</strong> {listing.type}</p>
          <p><strong>Tags:</strong> {listing.skillTags.join(", ")}</p>

          {/* NEW: only show the button if this ISN'T your own listing.
              Comparing listing.userId to myId (null if logged out or
              this is your own listing) determines what to show. */}
          {myId && listing.userId !== myId && (
            <button
              onClick={() => handleRequestSwap(listing._id)}
              disabled={requestedIds.includes(listing._id)}
            >
              {requestedIds.includes(listing._id) ? "Requested!" : "Request Swap"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default BrowseListings;