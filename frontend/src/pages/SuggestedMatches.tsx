import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { API_URL } from "../config";

// One flat, renderable card straight from the backend -- already
// flattened to a single listing, with only the matched tags included.
interface MatchCard {
  userId: string;
  listingId: string;
  title: string;
  description: string;
  type: "offer" | "want";
  skillTags: string[];
  matchedTags: string[];
  posterName: string;
}

function SuggestedMatches() {
  const navigate = useNavigate();

  const [matches, setMatches] = useState<MatchCard[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  async function fetchMatches(fetchOffset: number, isInitialLoad: boolean) {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`${API_URL}/api/matches?offset=${fetchOffset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (isInitialLoad) {
        setMatches(response.data.matches);
      } else {
        setMatches((prev) => [...prev, ...response.data.matches]);
      }

      setHasMore(response.data.hasMore);
      setOffset(response.data.nextOffset);
    } catch (err) {
      setError("Failed to load match suggestions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    fetchMatches(0, true);
  }, [token]);

  function handleLoadMore() {
    fetchMatches(offset, false);
  }

  if (!token) return null;

  return (
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-4 pb-8">
        <h1
          className="mb-6 text-center"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            color: "#4a7c59",
            fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
          }}
        >
          Suggested for You
        </h1>

        <p className="text-center text-[#7a6a58]" style={{ marginBottom: "48px" }}>
          Don't see what you're looking for?{" "}
          <Link to="/explore" className="text-[#8b5a2b] font-semibold hover:text-[#7a4a22] hover:underline">
            Search or explore listings yourself
          </Link>
        </p>

        {error && (
          <p
            className="mb-4 text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2 max-w-md"
            style={{ margin: "0 auto 16px" }}
          >
            {error}
          </p>
        )}

        {matches.length === 0 && !loading && !error && (
          <p className="text-center text-[#7a6a58]">No matches found yet.</p>
        )}

        {/* Single flat grid -- no sections, no labels. Exact matches
            always come first (backend guarantees this), AI-related
            ones fill any remaining slots up to 9 per page. The user
            never needs to know which mechanism found which card. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((card, index) => (
            <div
              key={`${card.listingId}-${index}`}
              className="bg-white/60 backdrop-blur-sm rounded-lg p-5 flex flex-col gap-2"
            >
              <Link
                to={`/listing/${card.listingId}`}
                className="text-lg font-semibold text-[#4a3620] hover:text-[#8b5a2b] hover:underline"
              >
                {card.title}
              </Link>

              <span
                className="self-start text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                style={
                  card.type === "offer"
                    ? { backgroundColor: "#e3ede3", color: "#4a7c59" }
                    : { backgroundColor: "#f4e3d0", color: "#b8590d" }
                }
              >
                {card.type}
              </span>

              <Link
                to={`/profile/${card.userId}`}
                className="text-sm text-[#7a6a58] hover:text-[#8b5a2b] hover:underline self-start"
              >
                Posted by {card.posterName}
              </Link>

              {/* Description shown only at `sm` and up -- keeps this
                  page's cards more compact than Explore's on mobile. */}
              <p className="hidden sm:block text-sm text-[#4a3620] line-clamp-3">
                {card.description}
              </p>

              {/* Only the tags that actually matched -- NOT the
                  listing's full tag list. */}
              <div className="flex flex-wrap gap-1 mt-1">
                {card.matchedTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-[#4a3620] bg-[#f1e5cc] border border-[#c9a06c] rounded-full px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {hasMore ? (
          <div className="flex justify-center mt-8">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="px-6 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22] disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load More Suggestions"}
            </button>
          </div>
        ) : (
          matches.length > 0 && (
            <p className="text-center text-[#7a6a58] mt-8">
              That's all the match suggestions available.
            </p>
          )
        )}
      </div>
    </div>
  );
}

export default SuggestedMatches;