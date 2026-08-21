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

  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stops the browser's default full-page-reload form behavior

    // Get the token saved during login (Phase 1). Without this,
    // the backend's requireAuth middleware will reject the request.
    const token = localStorage.getItem("token");

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
        <div>
          <label>Skill Tags (comma-separated)</label>
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