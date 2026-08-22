import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

// Mirrors the shape of one match object returned by GET /api/matches --
// matchType tells us whether it was an exact tag match or an
// AI-relatedness match, which affects how we label and highlight it.
// NOTE: no longer includes description/skillTags -- this page only
// shows a summary now; full details live on the listing's own page.
interface Listing {
  _id: string;
  title: string;
  type: "offer" | "want";
}

interface Match {
  userId: string;
  name: string;
  score: number;
  matchType: "exact" | "related";
  matchedTags: string[];
  listings: Listing[];
}

function SuggestedMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");

  // Shared function for both the initial load AND "Load more" --
  // the only difference is whether we REPLACE the matches list
  // (first load) or APPEND to it (load more), controlled by the
  // isInitialLoad flag.
  async function fetchMatches(fetchOffset: number, isInitialLoad: boolean) {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`http://localhost:5000/api/matches?offset=${fetchOffset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (isInitialLoad) {
        setMatches(response.data.matches);
      } else {
        // Spreads the EXISTING matches plus the newly fetched ones --
        // this is what makes "Load more" additive instead of
        // replacing what's already on screen.
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

  // Runs once on page load, starting at offset 0.
  useEffect(() => {
    fetchMatches(0, true);
  }, [token]);

  function handleLoadMore() {
    fetchMatches(offset, false);
  }

  return (
    <div>
      <h2>Suggested for You</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {matches.length === 0 && !loading && <p>No matches found yet.</p>}

      {matches.map((match, index) => (
        // index included in the key alongside userId, since -- in
        // theory -- the same userId could appear once per relevant
        // reason if this logic ever changes; harmless safety net.
        <div key={`${match.userId}-${index}`} style={{ border: "1px solid gray", padding: "10px", marginBottom: "10px" }}>
          <h3>{match.name}</h3>
          <p>
            <strong>{match.matchType === "exact" ? "Exact Match" : "Related Match"}</strong> — Score: {match.score}
          </p>
          {/* Shows WHICH tags triggered the match, without needing to
              render every listing's full tag list inline anymore --
              that detail now lives on the listing's own detail page. */}
          <p><em>Includes: {match.matchedTags.join(", ")}</em></p>

          {/* Each listing is now just a clickable title + type,
              linking into the dedicated detail page rather than
              being fully rendered here. Link (not a plain <a>) keeps
              navigation client-side, without a full page reload. */}
          {match.listings.map((listing) => (
            <p key={listing._id}>
              <Link to={`/listing/${listing._id}`}>{listing.title}</Link> ({listing.type})
            </p>
          ))}
        </div>
      ))}

      {hasMore ? (
        <button onClick={handleLoadMore} disabled={loading}>
          {loading ? "Loading..." : "Load More Suggestions"}
        </button>
      ) : (
        matches.length > 0 && <p>That's all the match suggestions available.</p>
      )}
    </div>
  );
}

export default SuggestedMatches;