import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardStats {
  name: string;
  joinedAt: string;
  completedCount: number;
  requestedCount: number;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  taughtCount: number;
  learnedCount: number;
  swapsOverTime: { month: string; count: number }[];
}

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function fetchStats() {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const statsRes = await axios.get("http://localhost:5000/api/users/me/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(statsRes.data);

        // trustScore isn't part of /me/stats -- it lives on the User
        // document itself, so a quick call to /api/auth/me gets it,
        // same source Profile.tsx already uses for the same value.
        const meRes = await axios.get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTrustScore(meRes.data.trustScore);
      } catch (err) {
        setError("Failed to load your dashboard.");
      }
    }

    fetchStats();
  }, [token, navigate]);

  if (error) return <p style={{ textAlign: "center", marginTop: "60px" }}>{error}</p>;
  if (!stats || trustScore === null) return <p style={{ textAlign: "center", marginTop: "60px" }}>Loading...</p>;

  // Taught vs. Learned needs to be shaped as an array of objects for
  // Recharts, even though it's really just two numbers -- one "row"
  // per bar, matching the shape swapsOverTime already comes in as.
  const taughtVsLearnedData = [
    { category: "Taught", count: stats.taughtCount },
    { category: "Learned", count: stats.learnedCount },
  ];

  return (
    <div style={{ maxWidth: "600px", margin: "60px auto", fontFamily: "sans-serif" }}>
      <Link to="/profile">← Back to Profile</Link>
      <h1>{stats.name}'s Dashboard</h1>
      <p><strong>Joined:</strong> {new Date(stats.joinedAt).toLocaleDateString()}</p>
      <p><strong>Trust Score:</strong> {trustScore}</p>

      <h3>Swap Activity</h3>
      <p><strong>Completed:</strong> {stats.completedCount}</p>
      <p><strong>Requested:</strong> {stats.requestedCount}</p>
      <p><strong>Pending:</strong> {stats.pendingCount}</p>
      <p><strong>Accepted:</strong> {stats.acceptedCount}</p>
      <p><strong>Rejected:</strong> {stats.rejectedCount}</p>
      <p><strong>Cancelled:</strong> {stats.cancelledCount}</p>

      <h3 style={{ marginTop: "32px" }}>Completed Swaps Over Time</h3>
      {stats.swapsOverTime.length === 0 ? (
        <p>No completed swaps yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={stats.swapsOverTime}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      )}

      <h3 style={{ marginTop: "32px" }}>Skills Taught vs. Learned</h3>
      {stats.taughtCount === 0 && stats.learnedCount === 0 ? (
        <p>No completed swaps yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={taughtVsLearnedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default Dashboard;