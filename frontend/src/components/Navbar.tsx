import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
  // Avatar (links to Profile) / Log Out.
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