import { Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import CreateListing from "./pages/CreateListing";
import Explore from "./pages/Explore";
import MyListings from "./pages/MyListings";
import SwapRequests from "./pages/SwapRequests";
import SuggestedMatches from "./pages/SuggestedMatches";
import ListingDetail from "./pages/ListingDetail";
import PublicProfile from "./pages/PublicProfile";
import MyReviews from "./pages/MyReviews";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";

function App() {
  return (
    <Routes>
      {/* Each Route maps a URL path to a page component */}
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/create-listing" element={<CreateListing />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/my-listings" element={<MyListings />} />
      <Route path="/swap-requests" element={<SwapRequests />} />
      <Route path="/suggested-matches" element={<SuggestedMatches />} />
      <Route path="/listing/:id" element={<ListingDetail />} />
      <Route path="/profile/:userId" element={<PublicProfile />} />
      <Route path="/my-reviews" element={<MyReviews />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/" element={<Home />} />
    </Routes>
  );
}

export default App;