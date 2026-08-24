import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

interface PublicProfileData {
  name: string;
  trustScore: number;
  completedSwapCount: number;
  joinedAt: string;
  activeListings: Listing[];
}

interface Listing {
  _id: string;
  title: string;
  description: string;
  type: "offer" | "want";
  skillTags: string[];
}

interface Rating {
  _id: string;
  raterId: { _id: string; name: string } | null;
  score: number;
  comment?: string;
  createdAt: string;
  helpfulUserIds: string[];
}

function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [sort, setSort] = useState<"recent" | "helpful">("recent");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [myId, setMyId] = useState<string | null>(null); // needed to check "have I voted"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function loadEverything() {
      try {
        // Step 1: find out who I am, IF logged in -- also doubles as
        // the data we need later for "have I already voted helpful."
        if (token) {
          const meRes = await axios.get("http://localhost:5000/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (meRes.data._id === userId) {
            navigate("/profile"); // viewing my own public profile -- redirect
            return;
          }

          setMyId(meRes.data._id);
        }

        // Step 2: fetch the public profile itself
        const profileRes = await axios.get(
          `http://localhost:5000/api/users/${userId}/profile`
        );
        setProfile(profileRes.data);

        // Step 3: fetch this user's ratings, respecting current sort and page
        const ratingsRes = await axios.get(
          `http://localhost:5000/api/ratings/user/${userId}?sort=${sort}&page=${page}`
        );
        setRatings(ratingsRes.data.ratings);
        setTotalPages(ratingsRes.data.totalPages);
      } catch (err) {
        setError("Failed to load this profile.");
      } finally {
        setLoading(false);
      }
    }

    loadEverything();
    // Re-runs if the sort toggle changes, so switching "Most Recent"
    // <-> "Most Helpful" re-fetches with the new order.
  }, [userId, token, navigate, sort, page]);

  // Toggles this rating's helpful vote, then updates just that one
  // rating in state using the server's response -- same "update in
  // place" pattern as SwapRequests.tsx's handleAction.
  async function toggleHelpful(ratingId: string) {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/ratings/${ratingId}/helpful`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRatings((prev) =>
        prev.map((r) => (r._id === ratingId ? response.data : r))
      );
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to update vote.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  if (loading) return <p style={{ textAlign: "center", marginTop: "60px" }}>Loading...</p>;
  if (error) return <p style={{ textAlign: "center", marginTop: "60px" }}>{error}</p>;
  if (!profile) return null; // shouldn't happen, but keeps TypeScript happy below

  return (
    <div style={{ maxWidth: "500px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>{profile.name}</h1>
      <p><strong>Trust Score:</strong> {profile.trustScore}</p>
      <p><strong>Completed Swaps:</strong> {profile.completedSwapCount}</p>
      <p><strong>Joined:</strong> {new Date(profile.joinedAt).toLocaleDateString()}</p>

      <h3>Active Listings</h3>
      {profile.activeListings.length === 0 && <p>No active listings.</p>}
      {profile.activeListings.map((listing) => (
        <div key={listing._id} style={{ border: "1px solid gray", padding: "10px", marginBottom: "8px" }}>
          <p><strong>{listing.title}</strong> ({listing.type})</p>
          <p>{listing.description}</p>
          <p>Tags: {listing.skillTags.join(", ")}</p>
        </div>
      ))}

      <h3>Reviews</h3>
      <div style={{ marginBottom: "10px" }}>
        <button onClick={() => { setSort("recent"); setPage(1); }} disabled={sort === "recent"}>
          Most Recent
        </button>
        <button onClick={() => { setSort("helpful"); setPage(1); }} disabled={sort === "helpful"}>
          Most Helpful
        </button>
      </div>

      {ratings.length === 0 && <p>No reviews yet.</p>}
      {ratings.map((rating) => {
        // Have I already voted this one helpful? Only relevant if
        // I'm logged in at all (myId is null for logged-out visitors).
        const iVoted = myId !== null && rating.helpfulUserIds.includes(myId);

        return (
          <div key={rating._id} style={{ border: "1px solid gray", padding: "10px", marginBottom: "8px" }}>
            <p><strong>{rating.raterId?.name || "Deleted User"}</strong> — {"★".repeat(rating.score)}{"☆".repeat(5 - rating.score)}</p>
            {rating.comment && <p>{rating.comment}</p>}
            <p style={{ fontSize: "12px", color: "gray" }}>
              {new Date(rating.createdAt).toLocaleDateString()}
            </p>

            {/* Helpful voting only makes sense if logged in, and the
                backend already blocks voting on a review ABOUT yourself
                -- but we don't know client-side who ratedUserId is here
                without an extra check, so we just let the backend be
                the source of truth and surface its error if blocked. */}
            {token && (
              <button onClick={() => toggleHelpful(rating._id)}>
                {iVoted ? "Unmark Helpful" : "Mark Helpful"} ({rating.helpfulUserIds.length})
              </button>
            )}
          </div>
        );
      })}
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

export default PublicProfile;