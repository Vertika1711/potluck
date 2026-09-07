import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { getAvatarSrc } from "../utils/avatar";
import { API_URL } from "../config";

interface PublicProfileData {
  name: string;
  trustScore: number;
  completedSwapCount: number;
  joinedAt: string;
  activeListings: Listing[];
  avatarId?: number;
}

interface Listing {
  _id: string;
  title: string;
  description: string;
  type: "offer" | "want";
  skillTags: string[];
}

interface Rating {
  _id: string;
  raterId: { _id: string; name: string } | null;
  score: number;
  comment?: string;
  createdAt: string;
  helpfulUserIds: string[];
}

function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [sort, setSort] = useState<"recent" | "helpful">("recent");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [myId, setMyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function loadEverything() {
      try {
        if (token) {
          const meRes = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (meRes.data._id === userId) {
            navigate("/profile");
            return;
          }

          setMyId(meRes.data._id);
        }

        const profileRes = await axios.get(
          `${API_URL}/api/users/${userId}/profile`
        );
        setProfile(profileRes.data);

        const ratingsRes = await axios.get(
          `${API_URL}/api/ratings/user/${userId}?sort=${sort}&page=${page}`
        );
        setRatings(ratingsRes.data.ratings);
        setTotalPages(ratingsRes.data.totalPages);
      } catch (err) {
        setError("Failed to load this profile.");
      } finally {
        setLoading(false);
      }
    }

    loadEverything();
  }, [userId, token, navigate, sort, page]);

  async function toggleHelpful(ratingId: string) {
    try {
      const response = await axios.put(
        `${API_URL}/api/ratings/${ratingId}/helpful`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRatings((prev) =>
        prev.map((r) => (r._id === ratingId ? response.data : r))
      );
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error || "Failed to update vote.");
      } else {
        setError("Something went wrong.");
      }
    }
  }

  function renderStars(score: number) {
    return [1, 2, 3, 4, 5].map((n) => (
      <span key={n} className="text-lg" style={{ color: n <= score ? "#ffb400" : "#d9cdb8" }}>
        ★
      </span>
    ));
  }

  function renderHeader() {
    return (
      <header className="sticky top-0 z-50 bg-[#f7ecd8] border-b border-[#c9a06c] px-4 sm:px-8 py-4 flex justify-between items-center relative">
        <Link
          to="/"
          className="text-2xl sm:text-3xl text-[#4a3620]"
          style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
        >
          Potluck
        </Link>

        <nav className="hidden lg:flex items-center gap-6 font-semibold">
          <Link to="/" className="text-[#4a3620] hover:text-[#8b5a2b]">
            Home
          </Link>
          <Link to="/explore" className="text-[#4a3620] hover:text-[#8b5a2b]">
            Explore
          </Link>

          {token ? (
            <Link to="/profile" className="text-[#4a3620] hover:text-[#8b5a2b]">
              My Profile
            </Link>
          ) : (
            <>
              <Link to="/login">
                <button className="px-4 py-2 border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]">
                  Log In
                </button>
              </Link>
              <Link to="/signup">
                <button className="px-4 py-2 bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]">
                  Sign Up
                </button>
              </Link>
            </>
          )}
        </nav>

        <button
          className="lg:hidden text-[#4a3620]"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <path d="M6 6L18 18M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M4 7H20M4 12H20M4 17H20" strokeLinecap="round" />
            )}
          </svg>
        </button>

        {mobileMenuOpen && (
          <nav className="lg:hidden absolute top-full left-0 w-full bg-[#f7ecd8] border-b border-[#c9a06c] flex flex-col items-center gap-4 py-6 font-semibold">
            <Link to="/" className="text-[#4a3620] hover:text-[#8b5a2b]" onClick={() => setMobileMenuOpen(false)}>
              Home
            </Link>
            <Link to="/explore" className="text-[#4a3620] hover:text-[#8b5a2b]" onClick={() => setMobileMenuOpen(false)}>
              Explore
            </Link>

            {token ? (
              <Link to="/profile" className="text-[#4a3620] hover:text-[#8b5a2b]" onClick={() => setMobileMenuOpen(false)}>
                My Profile
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <button className="px-4 py-2 border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]">
                    Log In
                  </button>
                </Link>
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <button className="px-4 py-2 bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]">
                    Sign Up
                  </button>
                </Link>
              </>
            )}
          </nav>
        )}
      </header>
    );
  }

  if (loading) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        {renderHeader()}
        <p className="text-center text-[#7a6a58] mt-16">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        {renderHeader()}
        <p className="text-center text-red-700 mt-16">{error}</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      {renderHeader()}

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="block mb-3 px-4 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
        >
          ← Back
        </button>

        <div className="flex flex-col items-center gap-0 mb-4">
          <img
            src={getAvatarSrc(userId!, profile.avatarId)}
            alt=""
            className="w-32 h-32 rounded-full object-cover"
            style={{ border: "4px solid #c9a06c" }}
          />
          <h1
            className="text-center"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              color: "#4a7c59",
              fontSize: "clamp(1.75rem, 5vw, 2.25rem)",
            }}
          >
            {profile.name}
          </h1>
        </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 flex flex-wrap justify-center gap-6 mb-3 text-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#7a6a58]">Trust Score</p>
            <p className="text-lg font-semibold text-[#4a7c59]">{profile.trustScore.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#7a6a58]">Completed Swaps</p>
            <p className="text-lg font-semibold text-[#4a3620]">{profile.completedSwapCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#7a6a58]">Joined</p>
            <p className="text-lg font-semibold text-[#4a3620]">
              {new Date(profile.joinedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div
          className="pl-3 py-2 mb-8 rounded"
          style={{ borderLeft: "4px solid #8b5a2b", backgroundColor: "#f1e5cc" }}
        >
          <p className="text-sm text-center" style={{ color: "#4a3620" }}>
            <span className="font-semibold" style={{ color: "#4a7c59" }}>Trust Score</span> is the average rating this person has received from completed swaps (out of 5).
          </p>
        </div>

        <h2 className="text-lg font-semibold mb-3" style={{ color: "#4a3620" }}>
          Active Listings
        </h2>

        {profile.activeListings.length === 0 && (
          <p className="text-[#7a6a58] mb-8">No active listings.</p>
        )}

        <div className="flex flex-col gap-2 mb-8">
          {profile.activeListings.map((listing) => (
            <Link
              key={listing._id}
              to={`/listing/${listing._id}`}
              className="bg-white/60 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-white/80 transition-colors"
            >
              <span
                className="text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                style={
                  listing.type === "offer"
                    ? { backgroundColor: "#e3ede3", color: "#4a7c59" }
                    : { backgroundColor: "#f4e3d0", color: "#b8590d" }
                }
              >
                {listing.type}
              </span>
              <span className="font-semibold text-[#4a3620]">{listing.title}</span>
              <div className="flex gap-1 ml-auto">
                {listing.skillTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-[#4a3620] bg-[#f1e5cc] border border-[#c9a06c] rounded-full px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
                {listing.skillTags.length > 3 && (
                  <span className="text-xs text-[#a99b82]">+{listing.skillTags.length - 3} more</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-3" style={{ color: "#4a3620" }}>
          Reviews
        </h2>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => { setSort("recent"); setPage(1); }}
            className={
              "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors " +
              (sort === "recent"
                ? "bg-[#8b5a2b] text-[#f7ecd8] border-[#8b5a2b]"
                : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
            }
          >
            Most Recent
          </button>
          <button
            onClick={() => { setSort("helpful"); setPage(1); }}
            className={
              "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors " +
              (sort === "helpful"
                ? "bg-[#8b5a2b] text-[#f7ecd8] border-[#8b5a2b]"
                : "bg-transparent text-[#4a3620] border-[#c9a06c] hover:bg-[#f1e5cc]")
            }
          >
            Most Helpful
          </button>
        </div>

        {ratings.length === 0 && <p className="text-[#7a6a58]">No reviews yet.</p>}

        <div className="flex flex-col gap-3">
          {ratings.map((rating) => {
            const iVoted = myId !== null && rating.helpfulUserIds.includes(myId);

            return (
              <div key={rating._id} className="bg-white/60 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-semibold text-[#4a3620]">
                    {rating.raterId?.name || "Deleted User"}
                  </p>
                  <div>{renderStars(rating.score)}</div>
                </div>

                {rating.comment && <p className="text-[#4a3620] mt-1">{rating.comment}</p>}

                <p className="text-xs text-[#a99b82] mt-2">
                  {new Date(rating.createdAt).toLocaleDateString()}
                </p>

                {token && (
                  <button
                    onClick={() => toggleHelpful(rating._id)}
                    className="mt-2 px-3 py-1 text-xs font-semibold border border-[#c9a06c] text-[#4a3620] rounded hover:bg-[#f1e5cc]"
                  >
                    {iVoted ? "Unmark Helpful" : "Mark Helpful"} ({rating.helpfulUserIds.length})
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-sm text-[#7a6a58]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-1.5 text-sm font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {ratings.length > 0 && page === totalPages && (
          <p className="text-center text-[#7a6a58] mt-4">
            You've reached the end — no more reviews to show.
          </p>
        )}
      </div>
    </div>
  );
}

export default PublicProfile;