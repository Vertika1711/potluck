// The 18 illustrated avatar images, imported so Vite bundles them properly
// (rather than referencing raw string paths, which wouldn't survive a
// production build's asset hashing).
import avatar00 from "../assets/avatars/avatar_00.png";
import avatar01 from "../assets/avatars/avatar_01.png";
import avatar02 from "../assets/avatars/avatar_02.png";
import avatar03 from "../assets/avatars/avatar_03.png";
import avatar04 from "../assets/avatars/avatar_04.png";
import avatar05 from "../assets/avatars/avatar_05.png";
import avatar06 from "../assets/avatars/avatar_06.png";
import avatar07 from "../assets/avatars/avatar_07.png";
import avatar08 from "../assets/avatars/avatar_08.png";
import avatar09 from "../assets/avatars/avatar_09.png";
import avatar10 from "../assets/avatars/avatar_10.png";
import avatar11 from "../assets/avatars/avatar_11.png";
import avatar12 from "../assets/avatars/avatar_12.png";
import avatar13 from "../assets/avatars/avatar_13.png";
import avatar14 from "../assets/avatars/avatar_14.png";
import avatar15 from "../assets/avatars/avatar_15.png";
import avatar16 from "../assets/avatars/avatar_16.png";
import avatar17 from "../assets/avatars/avatar_17.png";

export const AVATARS: string[] = [
  avatar00, avatar01, avatar02, avatar03, avatar04, avatar05,
  avatar06, avatar07, avatar08, avatar09, avatar10, avatar11,
  avatar12, avatar13, avatar14, avatar15, avatar16, avatar17,
];

// Deterministically picks an avatar index from a user's _id -- same
// person always gets the same avatar, automatically, with zero backend
// storage needed. Used as the FALLBACK when a user hasn't explicitly
// chosen one (avatarId is undefined/null on their User document).
// A simple string hash (not cryptographic -- doesn't need to be) summed
// over character codes, then modded down to the avatar count.
export function getDefaultAvatarIndex(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % AVATARS.length;
  }
  return Math.abs(hash) % AVATARS.length;
}

// The single function every page should call to get someone's avatar
// image -- handles both cases (explicitly chosen, or falls back to the
// deterministic default) in one place, so no page has to duplicate the
// fallback logic.
export function getAvatarSrc(userId: string, avatarId?: number | null): string {
  const index =
    avatarId !== undefined && avatarId !== null && avatarId >= 0 && avatarId < AVATARS.length
      ? avatarId
      : getDefaultAvatarIndex(userId);
  return AVATARS[index];
}