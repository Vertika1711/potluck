import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

// Describes the shape of one listing coming back from the backend,
// so TypeScript knows what fields we can safely use below.
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

  // NEW: holds whatever the user has typed into the skill-tag search box.
  const [searchQuery, setSearchQuery] = useState("");

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
      } catch (err) {
        setError("Failed to load listings.");
      }
    }

    fetchListings();
  }, []);

  // NEW: derived from "listings" + "searchQuery" on every render --
  // NOT its own separate state. This is deliberate: listings is the
  // single source of truth fetched from the backend, and the filtered
  // view is just a computed slice of it. Keeping a second "filtered
  // listings" state in sync with the original would be extra
  // bookkeeping for no real benefit here.
  //
  // A listing matches if the search query is empty (show everything),
  // OR if ANY of its skillTags contains the query text, case-insensitive.
  const filteredListings = listings.filter((listing) => {
    if (searchQuery.trim() === "") return true;

    const query = searchQuery.toLowerCase();
    return listing.skillTags.some((tag) => tag.toLowerCase().includes(query));
  });

  return (
    <div>
      <h2>Browse Listings</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* NEW: skill-tag search box -- filtering happens live as you type,
          no separate "Search" button needed since this is all client-side
          and instant (no backend round-trip). */}
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by skill tag (e.g. cooking, guitar)..."
        style={{ padding: "6px", marginBottom: "16px", width: "100%", maxWidth: "300px" }}
      />

      {/* NEW: friendly message when a search finds nothing, instead of
          just silently showing an empty page with no explanation. */}
      {searchQuery.trim() !== "" && filteredListings.length === 0 && (
        <p>No listings match "{searchQuery}".</p>
      )}

      {/* .map() turns each listing object into a visible block on the page.
          "key" is required by React whenever you render a list -- it uses
          the listing's unique _id to keep track of each item efficiently. */}
      {filteredListings.map((listing) => (
        <div key={listing._id} style={{ border: "1px solid gray", padding: "10px", marginBottom: "10px" }}>
          {/* Title is now a Link into the detail page, instead of plain
              text -- viewing full details and requesting a swap both
              happen there now, not inline on this browse view. */}
          <h3><Link to={`/listing/${listing._id}`}>{listing.title}</Link></h3>
          <p>{listing.description}</p>
          <p><strong>Type:</strong> {listing.type}</p>
          <p><strong>Tags:</strong> {listing.skillTags.join(", ")}</p>
        </div>
      ))}
    </div>
  );
}

export default BrowseListings;