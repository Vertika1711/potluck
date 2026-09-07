import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import { API_URL } from "../config";

function CreateListing() {
  // One piece of state per form field — same pattern as Signup/Login
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("offer"); // defaults to "offer"

  // CHANGED: skillTags is now a real string array, not a comma-separated
  // string -- matching the tag-chip pattern already used on
  // MyListings.tsx/Profile.tsx (decisions-log.md #16), since this was
  // the one remaining place in the app still using the older style.
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");

  const [error, setError] = useState("");

  // Tracks whether we're currently waiting on the AI call, so we can
  // disable the button and show "Suggesting..." feedback instead of
  // letting the user click it multiple times.
  const [isSuggesting, setIsSuggesting] = useState(false);

  const navigate = useNavigate();

  // Get the token saved during login (Phase 1). Without this,
  // the backend's requireAuth middleware will reject the request.
  const token = localStorage.getItem("token");

  // NEW: protected-route check, same pattern as Profile.tsx -- if
  // there's no token, redirect to /login immediately on load, instead
  // of letting a logged-out visitor see (and interact with) the whole
  // form before finding out at submit time that they can't actually
  // use it.
  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  // Avoids flashing the form for a split second before the redirect
  // above actually happens -- the effect runs after this first render,
  // so without this the form would still briefly appear.
  if (!token) return null;

  // Adds whatever's in newTagInput to skillTags -- trims whitespace,
  // ignores empty input, and blocks exact duplicates. Same logic as
  // MyListings.tsx's addTag.
  function addTag() {
    const trimmed = newTagInput.trim();
    if (trimmed === "" || skillTags.includes(trimmed)) return;
    setSkillTags((prev) => [...prev, trimmed]);
    setNewTagInput("");
  }

  function removeTag(tag: string) {
    setSkillTags((prev) => prev.filter((t) => t !== tag));
  }

  // Calls our AI tagging route using whatever's currently typed in the
  // description field, then fills skillTags with the AI's suggestions
  // directly -- the user can still edit (remove/add) them afterward.
  // CHANGED: response.data.tags is already a string array from the
  // backend, so this no longer needs to join/split anything -- that
  // extra conversion was only ever needed because the old input was
  // plain text.
  async function handleSuggestTags() {
    if (!description) {
      setError("Write a description first, then get AI suggestions.");
      return;
    }

    setIsSuggesting(true);
    setError("");

    try {
      const response = await axios.post(
        `${API_URL}/api/listings/suggest-tags`,
        { text: description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.aiFailed || response.data.tags.length === 0) {
        setError("AI suggestions unavailable right now -- you can add tags manually below.");
      } else {
        setSkillTags(response.data.tags);
      }
    } catch (err) {
      setError("AI suggestions unavailable right now -- you can add tags manually below.");
    } finally {
      setIsSuggesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stops the browser's default full-page-reload form behavior

    if (!token) {
      setError("You must be logged in to create a listing.");
      return;
    }

    try {
      // CHANGED: skillTags is already a clean array now, no need to
      // split/trim/filter a comma-separated string anymore.
      await axios.post(
        `${API_URL}/api/listings`,
        { title, description, type, skillTags },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      navigate("/my-listings"); // redirect to My Listings so the new listing is immediately visible
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to create listing.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  return (
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        {/* Same navigate(-1) back button pattern as ListingDetail.tsx --
            returns to whichever page the person actually came from
            (My Listings, Profile, wherever), rather than a hardcoded
            destination. */}
        <button
          onClick={() => navigate(-1)}
          className="block mb-6 px-4 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
        >
          ← Back
        </button>

        <h1
          className="mb-6 text-center"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 900,
            color: "#4a7c59",
            fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
          }}
        >
          Create a Listing
        </h1>

        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block mb-1 font-semibold text-[#4a3620]">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b]"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-[#4a3620]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                className="w-full px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] resize-y"
              />
            </div>

            {/* NEW: Offer/Want as two pill buttons instead of a native
                <select> -- matches the visual language already
                established on Explore's type filter, and is easier to
                style consistently than a browser-default dropdown. Each
                button carries both the short label and the fuller
                meaning, so nothing is lost compared to the old
                <option> text. */}
            <div>
              <label className="block mb-2 font-semibold text-[#4a3620]">Type</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setType("offer")}
                  className={
                    "flex-1 px-4 py-2 rounded-lg border-2 text-left transition-colors " +
                    (type === "offer"
                      ? "bg-[#8b5a2b] border-[#8b5a2b] text-[#f7ecd8]"
                      : "bg-transparent border-[#c9a06c] text-[#4a3620] hover:bg-[#f1e5cc]")
                  }
                >
                  <span className="block font-semibold">Offer</span>
                  <span className="block text-xs opacity-90">I can teach this</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType("want")}
                  className={
                    "flex-1 px-4 py-2 rounded-lg border-2 text-left transition-colors " +
                    (type === "want"
                      ? "bg-[#8b5a2b] border-[#8b5a2b] text-[#f7ecd8]"
                      : "bg-transparent border-[#c9a06c] text-[#4a3620] hover:bg-[#f1e5cc]")
                  }
                >
                  <span className="block font-semibold">Want</span>
                  <span className="block text-xs opacity-90">I want to learn this</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-[#4a3620]">
                Skill Tags
              </label>
              <p className="text-xs text-[#7a6a58]" style={{ marginBottom: "16px" }}>
                Review or edit the AI's suggestions, or add your own.
              </p>

              <div className="mb-3">
                <button
                  type="button"
                  onClick={handleSuggestTags}
                  disabled={isSuggesting}
                  className="float-right ml-2 mb-2 px-3 py-1.5 text-sm font-semibold border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0] disabled:opacity-60"
                >
                  {isSuggesting ? "Suggesting..." : "Suggest Tags with AI"}
                </button>

                {skillTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-sm text-[#4a3620] bg-[#f1e5cc] border border-[#c9a06c] rounded-full px-3 py-1 mr-2 mb-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="font-bold text-[#8b5a2b] hover:text-[#7a4a22]"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}

                <div className="clear-both" />
              </div>

              <div className="flex gap-2">
                <input
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault(); // stops Enter from submitting the whole form
                      addTag();
                    }
                  }}
                  placeholder="Type a skill and press Enter"
                  className="flex-1 px-3 py-2 rounded border border-[#c9a06c] bg-[#f7ecd8] text-[#4a3620] focus:outline-none focus:border-[#8b5a2b] placeholder:text-[#a99b82]"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 font-semibold border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]"
                >
                  Add
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="mt-2 py-2.5 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
            >
              Create Listing
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateListing;