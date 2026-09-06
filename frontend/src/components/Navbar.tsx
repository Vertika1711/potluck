import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useMyAvatar } from "../hooks/useMyAvatar";

interface NavbarProps {
  // Optional: called when the wordmark is clicked, INSTEAD of navigating
  // to "/". Home.tsx uses this to scroll to its own top section rather
  // than reloading the page. Every other page omits this, so the
  // wordmark just becomes a normal Link to "/".
  onLogoClick?: () => void;

  // Optional: page-specific extra nav items, rendered before the
  // standard login-aware links. Only Home.tsx currently uses this, for
  // its Home/About/Flow scroll buttons -- no other page has anything
  // like this. Passed as a function (not a plain node) so the caller
  // can wire each item's onClick to also close the mobile dropdown via
  // the closeMenu callback, the same way the standard links already do.
  renderExtraLinks?: (closeMenu: () => void) => React.ReactNode;
}

// NEW: shape of one notification, matching the backend's response --
// both real (stored) notifications and synthetic expiry reminders
// share this same shape, so the frontend never needs to special-case
// rendering between them.
interface Notification {
  _id: string;
  type: "new_request" | "your_turn" | "swap_completed" | "new_rating" | "swap_accepted" | "expiry_reminder";
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

// NEW: bell icon + unread badge + dropdown, polling for notifications
// while the user is logged in. Kept as its own plain function
// component (not nested inside Navbar) for the same reason
// AuthAwareLinks is -- avoids losing internal state on every Navbar
// re-render. Only ever rendered when a token exists (see AuthAwareLinks
// below), so it never needs to handle a logged-out case itself.
function NotificationBell({ token, onNavigate }: { token: string; onNavigate?: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const response = await axios.get("http://localhost:5000/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(response.data.notifications);
    } catch (err) {
      // Silently fail -- a missing notification list is a minor
      // cosmetic gap (the bell just shows no badge), not worth
      // surfacing an error banner for on every page.
    }
  }

  // Fetches once immediately on mount (so the badge doesn't wait a
  // full interval to reflect existing unread notifications), then
  // polls every 40 seconds while this component stays mounted --
  // effectively "while the user is logged in and has a page open,"
  // since Navbar (and this bell) unmounts/remounts with each page.
  // Deliberately plain interval polling, not WebSockets -- consistent
  // with this project's established preference for lightweight
  // solutions over new real-time infrastructure (decisions-log #6, #15).
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 40000);
    return () => clearInterval(interval);
  }, [token]);

  // Closes the dropdown if the user clicks anywhere outside it --
  // standard dropdown behavior, so it doesn't stay open indefinitely
  // once the person's attention has moved elsewhere.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Marks a single notification read (skipping synthetic expiry
  // reminders, which aren't stored documents and have no real /read
  // route to call), then navigates to wherever it points and closes
  // both the dropdown and (on mobile) the hamburger menu.
  async function handleNotificationClick(notification: Notification) {
    if (notification.type !== "expiry_reminder") {
      try {
        await axios.put(
          `http://localhost:5000/api/notifications/${notification._id}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotifications((prev) =>
          prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
        );
      } catch (err) {
        // Non-critical -- navigation still proceeds even if marking
        // read fails.
      }
    }

    setDropdownOpen(false);
    onNavigate?.();
    navigate(notification.link);
  }

  async function handleMarkAllRead() {
    try {
      await axios.put(
        "http://localhost:5000/api/notifications/read-all",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      // Non-critical -- the dropdown just keeps showing unread state.
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((open) => !open)}
        className="relative p-1.5 text-[#4a3620] hover:text-[#8b5a2b]"
        aria-label="Notifications"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Unread-count badge -- only shown when there's actually
            something unread, so a clean inbox shows a plain bell. */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center text-xs font-semibold text-white rounded-full"
            style={{ backgroundColor: "#b91c1c", minWidth: 18, height: 18, padding: "0 4px" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-[#f7ecd8] border border-[#c9a06c] rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9a06c]">
            <span className="font-semibold text-[#4a3620]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-[#8b5a2b] hover:text-[#7a4a22] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-[#7a6a58]">
              Nothing yet — you're all caught up.
            </p>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className="text-left px-4 py-3 border-b border-[#e5d9bd] last:border-b-0 hover:bg-white/50"
                  style={{ backgroundColor: n.read ? "transparent" : "#f1e5cc" }}
                >
                  {/* Expiry reminders get the same card treatment as
                      every other notification, just with the message
                      text itself colored to stand out -- per the
                      decision to keep visual differentiation minimal
                      (one highlighted detail, not a whole separate
                      style) rather than a distinct card design. */}
                  <p
                    className="text-sm"
                    style={{ color: n.type === "expiry_reminder" ? "#b8590d" : "#4a3620" }}
                  >
                    {n.message}
                  </p>
                  <p className="text-xs text-[#a99b82] mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Kept as a plain function (not a nested component definition inside
// Navbar) so it doesn't get recreated -- and lose any internal state --
// on every Navbar re-render. It doesn't need its own state here, but
// this is the safer default pattern regardless.
//
// Takes avatarSrc (or null while it's still loading/unavailable) --
// needed to render the avatar link and to build its /profile-vs-
// elsewhere active-page check, same as every other link already does
// via linkClass.
function AuthAwareLinks({
  token,
  onLogout,
  onNavigate,
  currentPath,
  avatarSrc,
}: {
  token: string | null;
  onLogout: () => void;
  onNavigate?: () => void;
  currentPath: string;
  avatarSrc: string | null;
}) {
  // The active page's link gets a distinct color + bold weight instead
  // of the default, so it reads as "you are here" rather than a
  // clickable link to somewhere else. Buttons (Log In/Sign Up/Log Out)
  // are excluded -- those are actions, not "pages," so highlighting
  // them wouldn't mean anything.
  function linkClass(path: string) {
    return currentPath === path
      ? "font-bold text-[#8b5a2b]"
      : "text-[#4a3620] hover:text-[#8b5a2b]";
  }

  // Order: Explore / Suggested Matches / Swap Requests / My Listings /
  // Notification Bell / Avatar (links to Profile) / Log Out.
  if (token) {
    return (
      <>
        <Link to="/explore" onClick={onNavigate} className={linkClass("/explore")}>
          Explore
        </Link>
        <Link to="/suggested-matches" onClick={onNavigate} className={linkClass("/suggested-matches")}>
          Suggested Matches
        </Link>
        <Link to="/swap-requests" onClick={onNavigate} className={linkClass("/swap-requests")}>
          Swap Requests
        </Link>
        <Link to="/my-listings" onClick={onNavigate} className={linkClass("/my-listings")}>
          My Listings
        </Link>

        {/* NEW: notification bell, placed just before the avatar --
            the standard "bell next to profile" position used by most
            apps. */}
        <NotificationBell token={token} onNavigate={onNavigate} />

        {/* Avatar replaces the old plain "Profile" text link. Falls
            back to a plain circular placeholder color (no image) for
            the brief moment before the avatar fetch resolves, rather
            than showing nothing at all. Active-page highlight uses a
            colored ring instead of bold text, since bolding an image
            does nothing -- same underlying "you are here" intent as
            linkClass, just expressed visually for an image link. */}
        <Link to="/profile" onClick={onNavigate} aria-label="My Profile" title="My Profile">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
              style={{
                border: currentPath === "/profile" ? "3px solid #8b5a2b" : "3px solid #c9a06c",
              }}
            />
          ) : (
            <span
              className="block w-9 h-9 rounded-full"
              style={{ backgroundColor: "#c9a06c" }}
            />
          )}
        </Link>

        <button
          onClick={() => {
            onLogout();
            onNavigate?.();
          }}
          className="px-4 py-2 border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]"
        >
          Log Out
        </button>
      </>
    );
  }

  // Logged-out set: Explore / Log In / Sign Up -- unchanged.
  return (
    <>
      <Link to="/explore" onClick={onNavigate} className={linkClass("/explore")}>
        Explore
      </Link>
      <Link to="/login" onClick={onNavigate}>
        <button className="px-4 py-2 border border-[#8b5a2b] text-[#4a3620] rounded hover:bg-[#efe0c0]">
          Log In
        </button>
      </Link>
      <Link to="/signup" onClick={onNavigate}>
        <button className="px-4 py-2 bg-[#8b5a2b] text-[#f7ecd8] rounded hover:bg-[#7a4a22]">
          Sign Up
        </button>
      </Link>
    </>
  );
}

function Navbar({ onLogoClick, renderExtraLinks }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Read fresh on every render rather than once in state -- this is a
  // display convenience, not a security boundary, so there's no need
  // for anything more elaborate than checking localStorage directly.
  // We deliberately do NOT verify the token is still valid here (that
  // would mean an API call just to render a header) -- if it's expired,
  // the person will still get redirected correctly the moment they try
  // to do anything that actually requires it, via each protected page's
  // own existing check (e.g. Profile.tsx's).
  const token = localStorage.getItem("token");

  // UPDATED: avatar-fetching logic now lives in a shared hook
  // (useMyAvatar), used identically by Home.tsx -- previously this was
  // a standalone useState/useEffect pair duplicated here alone. Same
  // behavior as before: null until the fetch resolves, or if logged
  // out / the fetch fails.
  const avatarSrc = useMyAvatar(token);

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  const wordmark = onLogoClick ? (
    <button
      onClick={onLogoClick}
      className="text-2xl sm:text-3xl text-[#4a3620] cursor-pointer"
      style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
    >
      Potluck
    </button>
  ) : (
    <Link
      to="/"
      className="text-2xl sm:text-3xl text-[#4a3620]"
      style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
    >
      Potluck
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-[#f7ecd8] border-b border-[#c9a06c] px-4 sm:px-8 py-4 flex justify-between items-center relative">
      {wordmark}

      {/* Desktop nav -- hidden below `lg`, same breakpoint as every
          other page's header. */}
      <nav className="hidden lg:flex items-center gap-6 font-semibold">
        {renderExtraLinks?.(closeMobileMenu)}
        <AuthAwareLinks
          token={token}
          onLogout={handleLogout}
          currentPath={location.pathname}
          avatarSrc={avatarSrc}
        />
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
          {renderExtraLinks?.(closeMobileMenu)}
          <AuthAwareLinks
            token={token}
            onLogout={handleLogout}
            onNavigate={closeMobileMenu}
            currentPath={location.pathname}
            avatarSrc={avatarSrc}
          />
        </nav>
      )}
    </header>
  );
}

export default Navbar;