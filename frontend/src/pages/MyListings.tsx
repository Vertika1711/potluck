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

function MyListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState("");

  // Tracks WHICH listing (by _id) is currently being edited, if any.
  // null means "nothing is being edited right now" -- all cards show normally.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Separate state just for the fields currently being edited --
  // kept apart from the main "listings" array so typing in the edit
  // form doesn't affect the displayed list until you actually save.
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSkillTags, setEditSkillTags] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function fetchMyListings() {
      try {
        // The backend's GET /api/listings returns ALL active listings,
        // not just yours -- so we fetch everything, then filter down
        // to only the ones where userId matches YOUR own profile id.
        const [listingsRes, profileRes] = await Promise.all([
          axios.get("http://localhost:5000/api/listings"),
          axios.get("http://localhost:5000/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const myId = profileRes.data._id;
        const mine = listingsRes.data.filter((listing: Listing) => listing.userId === myId);
        setListings(mine);
      } catch (err) {
        setError("Failed to load your listings.");
      }
    }

    fetchMyListings();
  }, [token]);

  // Called when clicking "Edit" on a specific listing card --
  // pre-fills the edit form with that listing's current values.
  function startEditing(listing: Listing) {
    setEditingId(listing._id);
    setEditTitle(listing.title);
    setEditDescription(listing.description);
    setEditSkillTags(listing.skillTags.join(", "));
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    try {
      const tagsArray = editSkillTags.split(",").map((t) => t.trim()).filter(Boolean);

      const response = await axios.put(
        `http://localhost:5000/api/listings/${id}`,
        { title: editTitle, description: editDescription, skillTags: tagsArray },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update just this one listing in local state with the server's
      // response, instead of re-fetching everything from scratch.
      setListings((prev) =>
        prev.map((listing) => (listing._id === id ? response.data : listing))
      );
      setEditingId(null); // exit edit mode, back to normal card view
    } catch (err) {
      setError("Failed to update listing.");
    }
  }

  async function handleDelete(id: string) {
    // A simple browser confirm dialog -- prevents accidental deletes
    // from a misclick, since this action can't be undone.
    const confirmed = window.confirm("Are you sure you want to delete this listing?");
    if (!confirmed) return;

    try {
      await axios.delete(`http://localhost:5000/api/listings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Remove it from local state so it disappears from the page immediately
      setListings((prev) => prev.filter((listing) => listing._id !== id));
    } catch (err) {
      setError("Failed to delete listing.");
    }
  }

  // Toggles a listing between "active" and "closed" -- e.g. when the
  // owner feels they've taught enough people, or wants to pause
  // requests without deleting the listing entirely.
  async function handleToggleStatus(listing: Listing) {
    const newStatus = listing.status === "active" ? "closed" : "active";

    try {
      const response = await axios.put(
        `http://localhost:5000/api/listings/${listing._id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setListings((prev) =>
        prev.map((l) => (l._id === listing._id ? response.data : l))
      );
    } catch (err) {
      setError("Failed to update listing status.");
    }
  }

  return (
    <div>
      <h2>My Listings</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {listings.map((listing) => (
        <div key={listing._id} style={{ border: "1px solid gray", padding: "10px", marginBottom: "10px" }}>
          {editingId === listing._id ? (
            // EDIT MODE -- shows input fields instead of plain text
            <div>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              <input value={editSkillTags} onChange={(e) => setEditSkillTags(e.target.value)} />
              <button onClick={() => saveEdit(listing._id)}>Save</button>
              <button onClick={cancelEditing}>Cancel</button>
            </div>
          ) : (
            // NORMAL VIEW MODE -- same layout as BrowseListings, plus buttons
            <div>
              <h3>{listing.title}</h3>
              <p>{listing.description}</p>
              <p><strong>Tags:</strong> {listing.skillTags.join(", ")}</p>
              <p><strong>Status:</strong> {listing.status}</p>
              <button onClick={() => startEditing(listing)}>Edit</button>
              <button onClick={() => handleDelete(listing._id)}>Delete</button>
              <button onClick={() => handleToggleStatus(listing)}>
                {listing.status === "active" ? "Close Listing" : "Reopen Listing"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default MyListings;