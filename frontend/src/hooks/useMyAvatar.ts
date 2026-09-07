import { useEffect, useState } from "react";
import axios from "axios";
import { getAvatarSrc } from "../utils/avatar";
import { API_URL } from "../config";

// Shared hook for "what avatar should I show for the currently logged-in
// user, if any" -- extracted here so Navbar.tsx and Home.tsx (and any
// future page needing the same thing) don't each duplicate their own
// copy of this fetch-and-derive logic. Returns null (not yet loaded, or
// not logged in) until the fetch resolves with a real avatar.
//
// This IS a genuine API call made from wherever this hook is used --
// a deliberate tradeoff (see Navbar.tsx's original comment on this)
// accepted so every page showing the avatar always reflects the
// CURRENT chosen avatar, without each page needing to pass it down
// manually from somewhere else.
export function useMyAvatar(token: string | null): string | null {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setAvatarSrc(null);
      return;
    }

    let cancelled = false;

    async function fetchAvatar() {
      try {
        const response = await axios.get(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          setAvatarSrc(getAvatarSrc(response.data._id, response.data.avatarId));
        }
      } catch (err) {
        // Silently fail -- a missing avatar just means the caller's
        // own placeholder keeps showing; this is a cosmetic detail,
        // not worth surfacing an error banner for on every page.
        if (!cancelled) setAvatarSrc(null);
      }
    }

    fetchAvatar();

    // Avoids a "set state after unmount" warning if the user navigates
    // away before this fetch resolves.
    return () => {
      cancelled = true;
    };
  }, [token]);

  return avatarSrc;
}