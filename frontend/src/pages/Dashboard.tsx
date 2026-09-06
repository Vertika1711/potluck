import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Navbar from "../components/Navbar";
import { getAvatarSrc } from "../utils/avatar";

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
  requestsOverTime: { month: string; count: number }[]; // NEW
  requestsReceivedOverTime: { month: string; count: number }[]; // NEW
}

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<number | undefined>(undefined);
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

        const meRes = await axios.get("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTrustScore(meRes.data.trustScore);
        setMyId(meRes.data._id);
        setAvatarId(meRes.data.avatarId);
      } catch (err) {
        setError("Failed to load your dashboard.");
      }
    }

    fetchStats();
  }, [token, navigate]);

  if (error) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        <Navbar />
        <p className="text-center text-red-700 mt-16">{error}</p>
      </div>
    );
  }

  if (!stats || trustScore === null || !myId) {
    return (
      <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
        <Navbar />
        <p className="text-center text-[#7a6a58] mt-16">Loading...</p>
      </div>
    );
  }

  const activeNow = stats.pendingCount + stats.acceptedCount;

  function buildInsightLine(): string {
    if (stats!.completedCount === 0) {
      return "You haven't completed a swap yet — once you do, this page will start telling your Potluck story.";
    }

    const swapWord = stats!.completedCount === 1 ? "swap" : "swaps";
    let line = `You've completed ${stats!.completedCount} ${swapWord} since joining`;

    if (stats!.taughtCount > stats!.learnedCount) {
      line += `, teaching more skills than you've learned so far — a real generous streak.`;
    } else if (stats!.learnedCount > stats!.taughtCount) {
      line += `, picking up more new skills than you've taught — plenty more room to share what you know too.`;
    } else {
      line += `, with an even split between teaching and learning.`;
    }

    return line;
  }

  const statusData = [
    { name: "Completed", value: stats.completedCount, color: "#4a7c59" },
    { name: "Accepted", value: stats.acceptedCount, color: "#8b5a2b" },
    { name: "Pending", value: stats.pendingCount, color: "#b8590d" },
    { name: "Rejected", value: stats.rejectedCount, color: "#b91c1c" },
    { name: "Cancelled", value: stats.cancelledCount, color: "#7a6a58" },
  ].filter((s) => s.value > 0);

  const totalSwaps = stats.completedCount + stats.acceptedCount + stats.pendingCount + stats.rejectedCount + stats.cancelledCount;

  const teachLearnTotal = stats.taughtCount + stats.learnedCount;
  const taughtPercent = teachLearnTotal === 0 ? 50 : (stats.taughtCount / teachLearnTotal) * 100;
  const learnedPercent = 100 - taughtPercent;

  // NEW: merges swapsOverTime (completed) and requestsOverTime (sent)
  // into ONE combined dataset, keyed by month, so a single chart can
  // show both series together instead of two separate charts. Any
  // month present in only one series gets 0 for the other, so the
  // chart doesn't show gaps or misaligned points.
  const allMonths = Array.from(
    new Set([
      ...stats.swapsOverTime.map((s) => s.month),
      ...stats.requestsOverTime.map((r) => r.month),
      ...stats.requestsReceivedOverTime.map((r) => r.month), // NEW
    ])
  ).sort();

  const activityData = allMonths.map((month) => ({
    month,
    completed: stats.swapsOverTime.find((s) => s.month === month)?.count || 0,
    requested: stats.requestsOverTime.find((r) => r.month === month)?.count || 0,
    // NEW
    received: stats.requestsReceivedOverTime.find((r) => r.month === month)?.count || 0,
  }));

  return (
    <div className="w-screen relative left-1/2 -ml-[50vw] min-h-screen bg-[#efe0c0] font-sans">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="block mb-6 px-4 py-2 font-semibold bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]"
        >
          ← Back
        </button>

        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-5 mb-6 flex items-center gap-4 flex-wrap">
          <img
            src={getAvatarSrc(myId, avatarId)}
            alt=""
            className="w-16 h-16 rounded-full object-cover"
            style={{ border: "3px solid #c9a06c" }}
          />
          <div>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 900,
                color: "#4a7c59",
                fontSize: "clamp(1.5rem, 4vw, 1.875rem)",
              }}
            >
              {stats.name}'s Insights
            </h1>
            <p className="text-sm text-[#7a6a58]">
              Member since {new Date(stats.joinedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-[#7a6a58] mb-1">Trust Score</p>
            <p className="text-2xl font-semibold" style={{ color: "#4a7c59" }}>{trustScore.toFixed(1)}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-[#7a6a58] mb-1">Completed</p>
            <p className="text-2xl font-semibold text-[#4a3620]">{stats.completedCount}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-[#7a6a58] mb-1">Requested</p>
            <p className="text-2xl font-semibold text-[#4a3620]">{stats.requestedCount}</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-[#7a6a58] mb-1">Active Now</p>
            <p className="text-2xl font-semibold" style={{ color: "#b8590d" }}>{activeNow}</p>
          </div>
        </div>

        <div
          className="pl-3 py-3 pr-3 rounded mb-8"
          style={{ borderLeft: "4px solid #4a7c59", backgroundColor: "#e3ede3" }}
        >
          <p className="text-sm" style={{ color: "#4a3620" }}>{buildInsightLine()}</p>
        </div>

        {/* UPDATED: Status Breakdown -- donut enlarged and centered with
            the legend using a wider gap, plus a NEW center overlay
            showing the total swap count, so the card no longer has a
            large empty gap between the chart and its legend. */}
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-5 mb-6">
          <h3 className="font-semibold mb-4" style={{ color: "#4a7c59" }}>Swap Status Breakdown</h3>

          {totalSwaps === 0 ? (
            <p className="text-sm text-[#7a6a58]">No swaps yet — once you send or receive a request, it'll show up here.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
              <div className="relative w-[240px] h-[240px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#f7ecd8", border: "1px solid #c9a06c", borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* NEW: center overlay showing the total -- fills the
                    donut's hollow middle with something meaningful
                    instead of leaving it visually empty. */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-semibold" style={{ color: "#4a3620" }}>{totalSwaps}</p>
                  <p className="text-xs text-[#7a6a58]">Total Swaps</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full sm:w-auto">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-sm">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[#4a3620] min-w-[90px]">{s.name}</span>
                    <span className="font-semibold text-[#4a3620]">{s.value}</span>
                    <span className="text-[#a99b82] text-xs">
                      ({Math.round((s.value / totalSwaps) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-5 mb-6">
          <h3 className="font-semibold mb-4" style={{ color: "#4a7c59" }}>Skills Taught vs. Learned</h3>

          {teachLearnTotal === 0 ? (
            <p className="text-sm text-[#7a6a58]">No completed swaps yet.</p>
          ) : (
            <>
              <div className="flex justify-between text-sm font-semibold mb-2">
                <span style={{ color: "#4a7c59" }}>Taught: {stats.taughtCount}</span>
                <span style={{ color: "#b8590d" }}>Learned: {stats.learnedCount}</span>
              </div>
              <div className="w-full h-4 rounded-full overflow-hidden flex" style={{ backgroundColor: "#e5d9bd" }}>
                <div style={{ width: `${taughtPercent}%`, backgroundColor: "#4a7c59" }} />
                <div style={{ width: `${learnedPercent}%`, backgroundColor: "#b8590d" }} />
              </div>
            </>
          )}
        </div>

        {/* UPDATED: "Your Activity Over Time" -- replaces the old
            single-series bar chart. Now a ComposedChart combining a
            gradient-filled Area (Requests Sent, a broader engagement
            signal) with a Line-with-dots on top (Completed Swaps), so
            a visitor can see both how often they're reaching out AND
            how many of those turn into finished swaps, in one chart
            instead of two separate ones. The gradient fill and dot
            markers replace the original plain bars for a more
            illustrative, less flat look. */}
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-5">
          <h3 className="font-semibold mb-4" style={{ color: "#4a7c59" }}>Your Activity Over Time</h3>

          {activityData.length === 0 ? (
            <p className="text-sm text-[#7a6a58]">No activity yet — once you send a request or complete a swap, it'll show up here.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={activityData}>
                <defs>
                  <linearGradient id="requestedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b8590d" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#b8590d" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5d9bd" />
                <XAxis dataKey="month" tick={{ fill: "#7a6a58", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#7a6a58", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#f7ecd8", border: "1px solid #c9a06c", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 13, color: "#4a3620" }} />
                <Area
                  type="monotone"
                  dataKey="requested"
                  name="Requests Sent"
                  stroke="#b8590d"
                  strokeWidth={2}
                  fill="url(#requestedFill)"
                />
                {/* NEW: Requests Received -- a plain dashed line (no
                    fill), visually distinct from the two other series
                    (a solid area, a solid heavy line) so three series
                    on one chart stay easy to tell apart at a glance. */}
                <Line
                  type="monotone"
                  dataKey="received"
                  name="Requests Received"
                  stroke="#6b8f9e"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 4, fill: "#6b8f9e", strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Completed Swaps"
                  stroke="#4a7c59"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#4a7c59", strokeWidth: 0 }}
                  activeDot={{ r: 7 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;