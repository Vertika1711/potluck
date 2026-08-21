import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function CreateListing() {
  // One piece of state per form field — same pattern as Signup/Login
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("offer"); // defaults to "offer"
  const [skillTags, setSkillTags] = useState(""); // typed as comma-separated text for now
  const [error, setError] = useState("");

  // NEW: tracks whether we're currently waiting on the AI call,
  // so we can disable the button and show "Suggesting..." feedback
  // instead of letting the user click it multiple times.
  const [isSuggesting, setIsSuggesting] = useState(false);

  const navigate = useNavigate();

  // Get the token saved during login (Phase 1). Without this,
  // the backend's requireAuth middleware will reject the request.
  // Moved up to component level (rather than inside handleSubmit only)
  // since both handleSubmit AND the new handleSuggestTags need it.
  const token = localStorage.getItem("token");

  // NEW: calls our AI tagging route using whatever's currently typed
  // in the description field, then fills the skillTags input with
  // the AI's suggestions -- the user can still edit them afterward.
  async function handleSuggestTags() {
    if (!description) {
      setError("Write a description first, then get AI suggestions.");
      return;
    }

    setIsSuggesting(true);
    setError("");

    try {
      const response = await axios.post(
        "http://localhost:5000/api/listings/suggest-tags",
        { text: description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.aiFailed || response.data.tags.length === 0) {
        // The backend already degrades gracefully -- this just tells
        // the user in plain language what happened, instead of silently
        // leaving the tags field empty with no explanation.
        setError("AI suggestions unavailable right now -- you can type tags manually below.");
      } else {
        setSkillTags(response.data.tags.join(", "));
      }
    } catch (err) {
      setError("AI suggestions unavailable right now -- you can type tags manually below.");
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
      // Turn "guitar, music, teaching" into ["guitar", "music", "teaching"]
      // .trim() removes accidental spaces around each tag,
      // .filter(Boolean) removes any empty strings (e.g. trailing comma)
      const tagsArray = skillTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      await axios.post(
        "http://localhost:5000/api/listings",
        { title, description, type, skillTags: tagsArray },
        {
          // This is the new part compared to Signup/Login — protected
          // routes require this Authorization header on every request
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      navigate("/profile"); // redirect somewhere sensible after success
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to create listing.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  return (
    <div>
      <h2>Create a Listing</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div>
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="offer">Offer (I can teach this)</option>
            <option value="want">Want (I want to learn this)</option>
          </select>
        </div>

        {/* NEW: the AI suggestion button, sitting between description and tags.
            type="button" (not "submit") is important here — without it, this
            button would submit the whole form instead of just running the
            AI suggestion function, since buttons inside a <form> default
            to type="submit". */}
        <div>
          <button type="button" onClick={handleSuggestTags} disabled={isSuggesting}>
            {isSuggesting ? "Suggesting..." : "Suggest Tags with AI"}
          </button>
        </div>

        <div>
          <label>Skill Tags (comma-separated — review/edit AI suggestions or type your own)</label>
          <input
            value={skillTags}
            onChange={(e) => setSkillTags(e.target.value)}
            placeholder="e.g. guitar, music"
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">Create Listing</button>
      </form>
    </div>
  );
}

export default CreateListing;