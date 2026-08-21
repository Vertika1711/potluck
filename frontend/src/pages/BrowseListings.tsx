import { useState, useEffect } from "react";
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
        </div>
      ))}
    </div>
  );
}

export default BrowseListings;