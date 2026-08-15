import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// Describes the shape of the user data we expect back from the backend
interface User {
  name: string;
  email: string;
  skillsOffered: string[];
  skillsWanted: string[];
  trustScore: number;
}

function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // useEffect runs once when this page first loads —
  // exactly when we want to fetch the user's data
  useEffect(() => {
    async function fetchProfile() {
      const token = localStorage.getItem("token");

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
      } catch (err) {
        // If the token is invalid or expired, the backend returns 401 —
        // in that case, clear the bad token and send the user to log in again
        localStorage.removeItem("token");
        setError("Session expired. Please log in again.");
        navigate("/login");
      }
    }

    fetchProfile();
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  if (error) {
    return <p style={{ textAlign: "center", marginTop: "60px" }}>{error}</p>;
  }

  if (!user) {
    return <p style={{ textAlign: "center", marginTop: "60px" }}>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: "400px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>My Profile</h1>
      <p><strong>Name:</strong> {user.name}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Trust Score:</strong> {user.trustScore}</p>
      <p><strong>Skills Offered:</strong> {user.skillsOffered.length > 0 ? user.skillsOffered.join(", ") : "None yet"}</p>
      <p><strong>Skills Wanted:</strong> {user.skillsWanted.length > 0 ? user.skillsWanted.join(", ") : "None yet"}</p>

      <button onClick={handleLogout} style={{ padding: "8px 16px", marginTop: "16px" }}>
        Log Out
      </button>
    </div>
  );
}

export default Profile;