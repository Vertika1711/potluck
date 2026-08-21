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

function SwapRequests() {
  const [incoming, setIncoming] = useState<Swap[]>([]);
  const [outgoing, setOutgoing] = useState<Swap[]>([]);
  const [error, setError] = useState("");

  // Maps a listing's _id to its title, so we can show "Guitar basics"
  // instead of a raw ObjectId string on each swap card. Built up
  // after fetching the swaps, since we only know which listings we
  // actually need titles for once we have the swap list in hand.
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({});

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