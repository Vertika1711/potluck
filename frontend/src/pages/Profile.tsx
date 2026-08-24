import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

// Describes the shape of the user data we expect back from the backend
interface User {
  _id: string;
  name: string;
  email: string;
  skillsOffered: string[];
  skillsWanted: string[];
  trustScore: number;
  phone?: string;
  phoneVisible: boolean;
}

// NEW: shape of one rating left about me -- same shape PublicProfile.tsx
// uses, just fetched for my own id instead of someone else's.
interface Rating {
  _id: string;
  raterId: { _id: string; name: string };
  score: number;
  comment?: string;
  createdAt: string;
}

function Profile() {
  const [user, setUser] = useState<User | null>(null);
  // NEW: my own most-recent review (a PREVIEW only, full list lives on
  // /my-reviews now), and my completed-swap count for the Dashboard preview.
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [completedSwapCount, setCompletedSwapCount] = useState(0);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // NEW: same edit-mode pattern as MyListings.tsx -- a boolean toggle
  // plus separate "edit..." state fields, kept apart from the main
  // "user" state so typing in the form doesn't affect the displayed
  // profile until Save is actually clicked.
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSkillsOffered, setEditSkillsOffered] = useState<string[]>([]);
  const [editSkillsWanted, setEditSkillsWanted] = useState<string[]>([]);
  const [newOfferedInput, setNewOfferedInput] = useState("");
  const [newWantedInput, setNewWantedInput] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPhoneVisible, setEditPhoneVisible] = useState(false);

  const token = localStorage.getItem("token");

  // useEffect runs once when this page first loads —
  // exactly when we want to fetch the user's data
  useEffect(() => {
    async function fetchProfile() {
      // If there's no token at all, the user was never logged in —
      // send them to the login page instead of showing a broken profile
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const response = await axios.get("http://localhost:5000/api/auth/me", {
          headers: {
            // This is exactly the "Bearer <token>" format we tested in Postman
            Authorization: `Bearer ${token}`,
          },
        });

        setUser(response.data);

        // NEW: switched from the old /api/users/:id/profile call to the
        // new /api/users/me/stats route -- simpler (no id needed, since
        // it derives "me" from the JWT), and it's the same route the
        // full Dashboard page will use, so this preview and that full
        // page always agree on the numbers.
        const statsRes = await axios.get("http://localhost:5000/api/users/me/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCompletedSwapCount(statsRes.data.completedCount);

        // NEW: my own MOST RECENT review only (limit=1) -- this is just
        // a preview; the full list with pagination/filtering now lives
        // on the dedicated /my-reviews page.
        const ratingsRes = await axios.get(
          `http://localhost:5000/api/ratings/user/${response.data._id}?limit=1`
        );
        setRatings(ratingsRes.data.ratings);
      } catch (err) {
        // If the token is invalid or expired, the backend returns 401 —
        // in that case, clear the bad token and send the user to log in again
        localStorage.removeItem("token");
        setError("Session expired. Please log in again.");
        navigate("/login");
      }
    }

    fetchProfile();
  }, [navigate, token]);

  // NEW: opens edit mode, pre-filling the form with the user's
  // current values -- same pattern as MyListings.tsx's startEditing.
  function startEditing() {
    if (!user) return;
    setIsEditing(true);
    setEditName(user.name);
    setEditSkillsOffered(user.skillsOffered);
    setEditSkillsWanted(user.skillsWanted);
    setEditPhone(user.phone || "");
    setEditPhoneVisible(user.phoneVisible);
    setNewOfferedInput("");
    setNewWantedInput("");
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  // NEW: generic add/remove tag helpers, parameterized by which list
  // to touch ("offered" or "wanted") -- avoids writing four nearly
  // identical functions, since the logic is the same either way.
  function addTag(list: "offered" | "wanted") {
    const input = list === "offered" ? newOfferedInput : newWantedInput;
    const setList = list === "offered" ? setEditSkillsOffered : setEditSkillsWanted;
    const current = list === "offered" ? editSkillsOffered : editSkillsWanted;
    const trimmed = input.trim();

    if (trimmed === "" || current.includes(trimmed)) return;

    setList((prev) => [...prev, trimmed]);
    if (list === "offered") setNewOfferedInput("");
    else setNewWantedInput("");
  }

  function removeTag(list: "offered" | "wanted", tag: string) {
    const setList = list === "offered" ? setEditSkillsOffered : setEditSkillsWanted;
    setList((prev) => prev.filter((t) => t !== tag));
  }

  // NEW: saves the edited fields via PUT /api/users/me. This is a
  // PARTIAL update on the backend, but we always send every field
  // here anyway since the form always has all of them loaded.
  async function saveEdit() {
    try {
      const response = await axios.put(
        "http://localhost:5000/api/users/me",
        {
          name: editName,
          skillsOffered: editSkillsOffered,
          skillsWanted: editSkillsWanted,
          phone: editPhone || undefined, // empty string becomes "not set", not a literal blank phone
          phoneVisible: editPhoneVisible,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser(response.data);
      setIsEditing(false);
    } catch (err) {
      setError("Failed to update profile.");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  // NEW: renders a chip-editable skill list -- shared by both the
  // offered and wanted sections in edit mode, same tag-chip pattern
  // as MyListings.tsx's skillTags editor.
  function renderTagEditor(
    list: "offered" | "wanted",
    tags: string[],
    inputValue: string,
    setInputValue: (v: string) => void
  ) {
    return (
      <div style={{ margin: "8px 0" }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-block",
              background: "#eee",
              color: "#333",
              borderRadius: "12px",
              padding: "4px 10px",
              marginRight: "6px",
              marginBottom: "6px",
              fontSize: "14px",
            }}
          >
            {tag}{" "}
            <span onClick={() => removeTag(list, tag)} style={{ cursor: "pointer", fontWeight: "bold" }}>
              ×
            </span>
          </span>
        ))}
        <div>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // stops Enter from submitting/reloading anything
                addTag(list);
              }
            }}
            placeholder="Type a skill and press Enter"
          />
          <button type="button" onClick={() => addTag(list)}>Add</button>
        </div>
      </div>
    );
  }

  if (error) {
    return <p style={{ textAlign: "center", marginTop: "60px" }}>{error}</p>;
  }

  if (!user) {
    return <p style={{ textAlign: "center", marginTop: "60px" }}>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: "500px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>My Profile</h1>

      {isEditing ? (
        // NEW: EDIT MODE -- shows input fields instead of plain text,
        // same in-place-editing idea as MyListings.tsx.
        <div>
          <label>Name:</label>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} />

          <p><strong>Skills Offered:</strong></p>
          {renderTagEditor("offered", editSkillsOffered, newOfferedInput, setNewOfferedInput)}

          <p><strong>Skills Wanted:</strong></p>
          {renderTagEditor("wanted", editSkillsWanted, newWantedInput, setNewWantedInput)}

          <p><strong>Phone (optional):</strong></p>
          <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="e.g. 9876543210" />

          <div style={{ marginTop: "8px" }}>
            <label>
              <input
                type="checkbox"
                checked={editPhoneVisible}
                onChange={(e) => setEditPhoneVisible(e.target.checked)}
              />
              {" "}Share my phone number with swap partners after a swap is accepted
            </label>
          </div>

          <div style={{ marginTop: "16px" }}>
            <button onClick={saveEdit}>Save</button>
            <button onClick={cancelEditing}>Cancel</button>
          </div>
        </div>
      ) : (
        // NORMAL VIEW MODE -- Trust Score and Completed Swaps REMOVED
        // from here, since they now live in the Dashboard preview
        // below, avoiding showing the same numbers twice on one page.
        <div>
          <p><strong>Name:</strong> {user.name}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Skills Offered:</strong> {user.skillsOffered.length > 0 ? user.skillsOffered.join(", ") : "None yet"}</p>
          <p><strong>Skills Wanted:</strong> {user.skillsWanted.length > 0 ? user.skillsWanted.join(", ") : "None yet"}</p>
          <p><strong>Phone:</strong> {user.phone ? `${user.phone} (${user.phoneVisible ? "visible to swap partners" : "hidden"})` : "Not set"}</p>

          <button onClick={startEditing} style={{ marginTop: "8px" }}>Edit Profile</button>
        </div>
      )}

      {/* NEW: Dashboard preview -- just Trust Score and Completed Swaps,
          with a link to the full /dashboard page for everything else
          (status breakdown, taught/learned, charts). */}
      <div style={{ border: "1px solid gray", padding: "12px", marginTop: "24px" }}>
        <h3 style={{ marginTop: 0 }}>Dashboard</h3>
        <p><strong>Trust Score:</strong> {user.trustScore}</p>
        <p><strong>Completed Swaps:</strong> {completedSwapCount}</p>
        <Link to="/dashboard">View Full Dashboard →</Link>
      </div>

      {/* NEW: Reviews preview -- just the most recent review, with a
          link to the full paginated /my-reviews page. */}
      <div style={{ border: "1px solid gray", padding: "12px", marginTop: "16px" }}>
        <h3 style={{ marginTop: 0 }}>Reviews</h3>
        {ratings.length === 0 && <p>No reviews yet.</p>}
        {ratings.map((rating) => (
          <div key={rating._id}>
            <p><strong>{rating.raterId.name}</strong> — {"★".repeat(rating.score)}{"☆".repeat(5 - rating.score)}</p>
            {rating.comment && <p>{rating.comment}</p>}
            <p style={{ fontSize: "12px", color: "gray" }}>{new Date(rating.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
        <Link to="/my-reviews">See All Reviews →</Link>
      </div>

      <button onClick={handleLogout} style={{ padding: "8px 16px", marginTop: "24px" }}>
        Log Out
      </button>
    </div>
  );
}

export default Profile;