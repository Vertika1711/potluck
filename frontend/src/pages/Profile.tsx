import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { AVATARS, getAvatarSrc } from "../utils/avatar";

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
  avatarId?: number;
}

// NEW: shape of one rating left about me -- same shape PublicProfile.tsx
// uses, just fetched for my own id instead of someone else's.
interface Rating {
  _id: string;
  raterId: { _id: string; name: string } | null;
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
  const [joinedAt, setJoinedAt] = useState<string>("");
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
  const [editAvatarId, setEditAvatarId] = useState<number | undefined>(undefined);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

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
        setJoinedAt(statsRes.data.joinedAt);

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
    setEditAvatarId(
      user.avatarId !== undefined ? user.avatarId : AVATARS.indexOf(getAvatarSrc(user._id))
    );
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
          avatarId: editAvatarId,
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

  async function handleDeleteAccount() {
    setDeleteError("");

    if (!deletePassword) {
      setDeleteError("Please enter your password to confirm.");
      return;
    }

    try {
      await axios.delete("http://localhost:5000/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
        data: { password: deletePassword }, // DELETE requests send a body via "data", not a second argument like POST/PUT
      });

      // Account is gone -- clear the token and send them off, same as
      // a logout, but there's genuinely nothing to log back into now.
      localStorage.removeItem("token");
      navigate("/signup");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setDeleteError(err.response.data.error || "Failed to delete account.");
      } else {
        setDeleteError("Something went wrong.");
      }
    }
  }

  // UPDATED: renders a chip-editable skill list -- shared by both the
  // offered and wanted sections in edit mode.
  function renderTagEditor(
    list: "offered" | "wanted",
    tags: string[],
    inputValue: string,
    setInputValue: (v: string) => void
  ) {
    return (
      <div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-sm text-[#4a3620] bg-[#f1e5cc] border border-[#c9a06c] rounded-full px-3 py-1"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(list, tag)}
                  className="font-bold text-[#8b5a2b] hover:text-[#7a4a22]"
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(list);
              }
            }}
            placeholder="Type a skill and press Enter"
            className="flex-1 min-w-0 px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
          />
          <button
            type="button"
            onClick={() => addTag(list)}
            className="px-3 py-2 font-semibold border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]"
          >
            Add
          </button>
        </div>
      </div>
    );
  }

  // Renders a plain (non-editable) skill list as small pill tags.
  function renderTagList(tags: string[]) {
    if (tags.length === 0) {
      return <p className="text-sm text-[#a99b82] italic">None yet</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-xs text-[#4a3620] bg-[#f7ecd8] border border-[#c9a06c] rounded-full px-2 py-0.5"
          >
          {tag}
          </span>
        ))}
      </div>
    );
  }

  // Renders the 18-avatar picker grid, used only in edit mode.
  function renderAvatarPicker() {
    return (
      <div className="grid grid-cols-6 gap-2 justify-items-center">
        {AVATARS.map((src, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setEditAvatarId(index)}
            className="rounded-full overflow-hidden"
            style={{
              border: editAvatarId === index ? "3px solid #8b5a2b" : "3px solid transparent",
            }}
            aria-label={`Choose avatar ${index + 1}`}
          >
            <img src={src} alt="" className="w-full h-full object-cover rounded-full" />
          </button>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        <Navbar />
        <p className="text-center text-red-700 mt-16">{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        <Navbar />
        <p className="text-center text-[#7a6a58] mt-16">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      <Navbar />

      {/* UPDATED: the standalone "My Profile" page heading was removed --
          the identity card below now opens directly with the avatar and
          name, matching PublicProfile.tsx's structure (where the name
          IS the page's heading, with no separate title above it). */}
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        {/* UPDATED: identity card -- avatar and name now centered INSIDE
            the card (PublicProfile's layout), tightly stacked, rather
            than the previous left-aligned "avatar beside name" row.
            Edit Profile is now an icon-only button, absolutely
            positioned in the card's top-right corner. Padding/margin
            tightened (p-5/mb-6 -> p-4/mb-4) since the card was reading
            as oversized relative to its actual content. */}
        <div className="relative bg-white/60 backdrop-blur-sm rounded-lg p-4 mb-4">
          {!isEditing && (
            <button
              onClick={startEditing}
              className="absolute top-4 right-4 p-2 bg-[#8b5a2b] text-[#f7ecd8] rounded-full hover:bg-[#7a4a22]"
              aria-label="Edit Profile"
              title="Edit Profile"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" strokeLinecap="round" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {isEditing ? (
            // EDIT MODE
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2">
                <label className="font-semibold text-[#4a3620]">Choose an Avatar</label>
                {renderAvatarPicker()}
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[#4a3620]">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b]"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-[#4a3620]">Phone (optional)</label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
                />
                <label className="flex items-center gap-2 mt-2 text-sm text-[#4a3620]">
                  <input
                    type="checkbox"
                    checked={editPhoneVisible}
                    onChange={(e) => setEditPhoneVisible(e.target.checked)}
                    className="accent-[#8b5a2b] w-4 h-4"
                  />
                  Share my phone number with swap partners after a swap is accepted
                </label>
              </div>

              {/* UPDATED: skills editors laid out as two side-by-side
                  columns (matching how they're displayed in view mode
                  below), instead of stacked full-width. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 font-semibold text-[#4a3620]">Skills Offered</label>
                  {renderTagEditor("offered", editSkillsOffered, newOfferedInput, setNewOfferedInput)}
                </div>
                <div>
                  <label className="block mb-1 font-semibold text-[#4a3620]">Skills Wanted</label>
                  {renderTagEditor("wanted", editSkillsWanted, newWantedInput, setNewWantedInput)}
                </div>
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  onClick={saveEdit}
                  className="px-4 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
                >
                  Save
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-4 py-2 font-semibold border border-[#c9a06c] text-[#4a3620] rounded hover:bg-[#f1e5cc]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // VIEW MODE
            <div className="flex flex-col gap-1">
              {/* Avatar + name, centered, tightly stacked -- matches
                  PublicProfile.tsx's structure. Avatar sized down from
                  an earlier 32 to 24 with a thinner border, and the name
                  pulled up with a small negative margin, so this whole
                  block takes up meaningfully less vertical space. */}
              <div className="flex flex-col items-center gap-0">
                <img
                  src={getAvatarSrc(user._id, user.avatarId)}
                  alt=""
                  className="w-30 h-30 rounded-full object-cover"
                  style={{ border: "4px solid #c9a06c" }}
                />
                <h1
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 900,
                    color: "#4a7c59",
                    fontSize: "clamp(1.5rem, 4vw, 1.875rem)",
                  }}
                >
                  {user.name}
                </h1>
              </div>

              {/* Email (left) / phone (right, only if set) -- bolded,
                  smaller than before, "visible to swap partners" on its
                  own line below the phone number. */}
              <div className="flex items-start justify-between flex-wrap gap-2 px-2 sm:px-4">
                <span className="text-sm font-semibold" style={{ color: "#4a3620" }}>Email: {user.email}</span>
                {user.phone && (
                  <div className="text-right">
                    <span className="text-sm font-semibold" style={{ color: "#4a3620" }}>Phone: {user.phone}</span>
                    <p className="text-xs text-[#a99b82]">
                      ({user.phoneVisible ? "visible to swap partners" : "hidden"})
                    </p>
                  </div>
                )}
              </div>

              {/* Skills Offered / Skills Wanted -- two distinct sub-cards
                  (accent cream background, distinguishing them from the
                  main translucent card), tightened padding/gap. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <div className="rounded-lg p-3" style={{ backgroundColor: "#f1e5cc" }}>
                  <p className="text-sm font-semibold text-[#4a3620] mb-1.5">Skills Offered</p>
                  {renderTagList(user.skillsOffered)}
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: "#f1e5cc" }}>
                  <p className="text-sm font-semibold text-[#4a3620] mb-1.5">Skills Wanted</p>
                  {renderTagList(user.skillsWanted)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard preview -- a single, horizontally elongated
            full-width card. Stat row matches PublicProfile.tsx's exact
            layout (Trust Score / Completed Swaps / Joined), followed by
            a short line of copy and a real "View Full Dashboard" button. */}
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-5 mb-6 text-center">
          <h3 className="font-semibold mb-3" style={{ color: "#4a7c59" }}>Your Potluck Insights</h3>

          <div className="flex flex-wrap justify-center gap-8 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#7a6a58]">Trust Score</p>
              <p className="text-lg font-semibold text-[#4a7c59]">{user.trustScore.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[#7a6a58]">Completed Swaps</p>
              <p className="text-lg font-semibold text-[#4a3620]">{completedSwapCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[#7a6a58]">Joined</p>
              <p className="text-lg font-semibold text-[#4a3620]">
                {joinedAt ? new Date(joinedAt).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>

          {/* NEW: invitation line + button enclosed in the same
              accent-box style used for the Trust Score explanation
              above (thin colored left border, tinted background) --
              visually groups this "go deeper" prompt as its own
              distinct unit within the card, rather than floating as
              plain text beneath the stats. */}
          <div
            className="pl-3 py-3 pr-3 rounded flex flex-col items-center gap-3"
            style={{ borderLeft: "4px solid #4a7c59", backgroundColor: "#e3ede3" }}
          >
            <p className="text-sm max-w-md" style={{ color: "#4a3620" }}>
              There's more to your Potluck journey. View your complete insights, activity, and swap history.
            </p>

            <Link
              to="/dashboard"
              className="inline-block px-5 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              View Full Dashboard →
            </Link>
          </div>
        </div>

        {/* UPDATED: Reviews preview, restyled to match the Dashboard
            card's structure -- heading, content, then a "go deeper"
            callout box (same accent-box treatment) wrapping the link
            through to the full page. */}
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-5 mb-6 text-center">
          <h3 className="font-semibold mb-3" style={{ color: "#4a7c59" }}>What People Say</h3>

          {ratings.length === 0 ? (
            <p className="text-sm text-[#7a6a58] mb-4">No reviews yet.</p>
          ) : (
            <div className="mb-4">
              {ratings.map((rating) => (
                <div key={rating._id}>
                  <p className="text-sm font-semibold text-[#4a3620]">
                    {rating.raterId?.name || "Deleted User"}
                  </p>
                  <div className="my-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className="text-sm"
                        style={{ color: n <= rating.score ? "#ffb400" : "#d9cdb8" }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  {rating.comment && (
                    <p className="text-sm text-[#4a3620]">{rating.comment}</p>
                  )}
                  <p className="text-xs text-[#a99b82]">
                    {new Date(rating.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Same accent-box treatment as the Dashboard card's callout --
              consistent "go deeper" pattern across both preview cards. */}
          <div
            className="pl-3 py-3 pr-3 rounded flex flex-col items-center gap-3"
            style={{ borderLeft: "4px solid #4a7c59", backgroundColor: "#e3ede3" }}
          >
            <p className="text-sm max-w-md" style={{ color: "#4a3620" }}>
              See everything people have said about swapping with you, sorted your way.
            </p>

            <Link
              to="/my-reviews"
              className="inline-block px-5 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              See All Reviews →
            </Link>
          </div>
        </div>

        {/* "Account" section -- combines Log Out and Delete Account into
            one place, so this page is the one-stop location for
            account-level actions. Navbar.tsx's Log Out stays as-is
            (it's a shared, global convenience used by six other pages)
            -- this doesn't replace that, it just gives Profile its own
            complete, self-contained account-actions area. */}
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-5">
          <h3 className="font-semibold mb-3" style={{ color: "#4a7c59" }}>Account</h3>

          <div className="flex items-center justify-between flex-wrap gap-3 pb-4" style={{ borderBottom: "1px solid #e5d9bd" }}>
            <div>
              <p className="text-sm font-semibold text-[#4a3620]">Log Out</p>
              <p className="text-xs text-[#7a6a58]">Sign out of your Potluck account on this device.</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]"
            >
              Log Out
            </button>
          </div>

          {/* Danger Zone -- restrained styling (cream background, thin
              muted-red border), living inside the broader Account
              section instead of standing alone. */}
          <div className="pt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="font-semibold text-sm" style={{ color: "#b91c1c" }}>Delete Account</h4>
                <p className="text-xs text-[#7a6a58]">
                  Deleting your account is permanent and cannot be undone.
                </p>
              </div>

              {!showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-1.5 text-sm font-semibold bg-red-600 text-white rounded hover:bg-red-700 shrink-0"
                >
                  Delete Account
                </button>
              )}
            </div>

            {showDeleteConfirm && (
              <div className="flex flex-col gap-3 mt-4 pt-4" style={{ borderTop: "1px solid #d99" }}>
                <p className="text-sm text-red-700">
                  This will permanently delete your account. Any pending or accepted
                  swaps will be cancelled. This cannot be undone.
                </p>
                <input
                  type="password"
                  placeholder="Enter your password to confirm"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="px-3 py-2 rounded border border-red-300 bg-white text-[#4a3620] focus:outline-none focus:border-red-500 placeholder:text-[#a99b82]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Yes, Delete My Account
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(""); }}
                    className="px-4 py-2 text-sm font-semibold border border-[#c9a06c] text-[#4a3620] rounded hover:bg-[#f1e5cc]"
                  >
                    Cancel
                  </button>
                </div>
                {deleteError && <p className="text-sm text-red-700">{deleteError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;