import { Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import CreateListing from "./pages/CreateListing";
import BrowseListings from "./pages/BrowseListings"
import MyListings from "./pages/MyListings";
import SwapRequests from "./pages/SwapRequests";

function App() {
  return (
    <Routes>
      {/* Each Route maps a URL path to a page component */}
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/create-listing" element={<CreateListing />} />
      <Route path="/browse-listings" element={<BrowseListings />} />
      <Route path="/my-listings" element={<MyListings />} />
      <Route path="/swap-requests" element={<SwapRequests />} />
    </Routes>
  );
}

export default App;