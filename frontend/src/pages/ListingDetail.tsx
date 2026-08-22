import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

interface Listing {
  _id: string;
  userId: { _id: string; name: string };
  title: string;
  description: string;
  type: "offer" | "want";
  skillTags: string[];
  status: string;
}

function ListingDetail() {
  // useParams reads the dynamic part of the URL -- if this page is
  // reached via /listing/abc123, then id === "abc123". This matches
  // the :id placeholder we'll define in the route in App.tsx.
  const { id } = useParams();

  const [listing, setListing] = useState<Listing | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function fetchListing() {
      try {
        const response = await axios.get(`http://localhost:5000/api/listings/${id}`);
        setListing(response.data);

        if (token) {
          const profileRes = await axios.get("http://localhost:5000/api/auth/me", {
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

  // Same request-swap logic as BrowseListings.tsx, just living here
  // now instead -- this page becomes the ONE place swap requests
  // actually get sent from.
  async function handleRequestSwap() {
    if (!token || !listing) {
      setError("You must be logged in to request a swap.");
      return;
    }

    try {
      await axios.post(
        "http://localhost:5000/api/swaps",
        { listingId: listing._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequested(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to send swap request.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!listing) return <p>Loading...</p>;

  // listing.userId is the POPULATED object ({ _id, name }) since the
  // backend route uses .populate() -- so listing.userId._id is what
  // we compare against myId, and listing.userId.name is what we display.
  const isOwnListing = myId === listing.userId._id;

  return (
    <div>
      <h2>{listing.title}</h2>
      <p><strong>Posted by:</strong> {listing.userId.name}</p>
      <p><strong>Type:</strong> {listing.type}</p>
      <p>{listing.description}</p>
      <p><strong>Tags:</strong> {listing.skillTags.join(", ")}</p>

      {!isOwnListing && myId && (
        <button onClick={handleRequestSwap} disabled={requested}>
          {requested ? "Requested!" : "Request Swap"}
        </button>
      )}
    </div>
  );
}

export default ListingDetail;