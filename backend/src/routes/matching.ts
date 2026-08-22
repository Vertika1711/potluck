import { Router } from "express";
import Listing from "../models/Listing.js";
import User from "../models/User.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

import OpenAI from "openai";

const router = Router();

// Groups a flat list of listings by which user owns them -- used for
// BOTH exact-match scoring and the AI-relatedness pool, since a
// "candidate" is a whole person's skill profile, not one listing.
function groupListingsByUser(listings: any[]) {
  const grouped: Record<string, any[]> = {};
  for (const listing of listings) {
    const id = listing.userId.toString();
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(listing);
  }
  return grouped;
}

// Computes exact-tag-match scores for every candidate, in BOTH
// directions (my wants vs their offers, my offers vs their wants),
// per the brief's "mutual match combines scores from both directions."
// No cap here -- every genuine exact match is included; capping only
// happens later, at the pagination step.
async function getExactMatches(
  myWantTags: string[],
  myOfferTags: string[],
  listingsByUser: Record<string, any[]>
) {
    const candidates: { userId: string; score: number; matchedTags: string[]; listings: any[] }[] = [];

  for (const [candidateUserId, candidateListings] of Object.entries(listingsByUser)) {
    const theirWantTags = candidateListings.filter((l) => l.type === "want").flatMap((l) => l.skillTags);
    const theirOfferTags = candidateListings.filter((l) => l.type === "offer").flatMap((l) => l.skillTags);

    const forwardMatches = myWantTags.filter((tag) => theirOfferTags.includes(tag));
    const backwardMatches = myOfferTags.filter((tag) => theirWantTags.includes(tag));

    const exactScore = (forwardMatches.length + backwardMatches.length) * 50;

        if (exactScore > 0) {
      candidates.push({
        userId: candidateUserId,
        score: exactScore,
        matchedTags: [...new Set([...forwardMatches, ...backwardMatches])],
        // Carries the candidate's actual listings through, so the
        // frontend can render real cards (not just an ID) and know
        // which specific tags to highlight within them.
        listings: candidateListings.map((l) => ({
          _id: l._id,
          title: l.title,
          description: l.description,
          type: l.type,
          skillTags: l.skillTags,
        })),
      });
    }
  }

  // Fetch trust scores for every candidate in ONE query (not one per
  // candidate), so we can break ties fairly. NOTE: trustScore is always
  // 0 for everyone right now, since Phase 5 hasn't been built yet --
  // this tiebreak logic is correct and ready, but won't visibly do
  // anything until real trust scores exist.
  const userIds = candidates.map((c) => c.userId);
  const users = await User.find({ _id: { $in: userIds } }).select("trustScore");
  const trustScoreByUserId: Record<string, number> = {};
  users.forEach((u) => {
    trustScoreByUserId[(u._id as any).toString()] = u.trustScore;
  });

  const withTrust = candidates.map((c) => ({
    ...c,
    trustScore: trustScoreByUserId[c.userId] || 0,
  }));

  // Primary sort: highest score first. Tiebreak: higher trust score first.
  withTrust.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.trustScore - a.trustScore;
  });

  return withTrust;
}

// Builds the pool of candidates who have ZERO exact matches -- these
// are only worth considering via AI relatedness scoring. Sorted by
// userId (a stable, arbitrary-but-consistent order) so that page 2's
// "next 6" always means the same actual people as it did on a
// previous request, rather than shifting around unpredictably.
function getAiCandidatePool(
  myWantTags: string[],
  myOfferTags: string[],
  listingsByUser: Record<string, any[]>,
  exactMatchUserIds: Set<string>
) {
  const pool: {
    userId: string;
    theirWantTags: string[];
    theirOfferTags: string[];
    listings: any[];
  }[] = [];

  for (const [candidateUserId, candidateListings] of Object.entries(listingsByUser)) {
    // Skip anyone who already scored an exact match -- they're
    // already handled by getExactMatches, we don't want them
    // considered twice or double-counted in the AI tier.
    if (exactMatchUserIds.has(candidateUserId)) continue;

    const theirWantTags = candidateListings.filter((l) => l.type === "want").flatMap((l) => l.skillTags);
    const theirOfferTags = candidateListings.filter((l) => l.type === "offer").flatMap((l) => l.skillTags);

    // Only worth including if there's SOMETHING to compare -- a
    // candidate with no tags at all on either side can't meaningfully
    // be scored for relatedness.
        if (theirWantTags.length > 0 || theirOfferTags.length > 0) {
      pool.push({
        userId: candidateUserId,
        theirWantTags,
        theirOfferTags,
        listings: candidateListings.map((l) => ({
          _id: l._id,
          title: l.title,
          description: l.description,
          type: l.type,
          skillTags: l.skillTags,
        })),
      });
    }
  }

  // Stable sort by userId string -- arbitrary choice, but consistent
  // across requests, which is what actually matters for pagination.
  pool.sort((a, b) => a.userId.localeCompare(b.userId));

  return pool;
}

// Same lazy-client pattern as listings.ts's suggest-tags route --
// created only when actually called, not at module import time,
// avoiding the "Missing credentials" startup crash from Phase 2.
function getGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

// For ONE candidate with zero exact matches, asks the AI whether any
// of their tags are meaningfully related to any of mine, in EITHER
// direction (my wants vs their offers, my offers vs their wants) --
// same "mutual match" principle as the exact-match scoring.
// Returns null if nothing is genuinely related, or the AI call fails.
async function getAiRelatedness(
  myWantTags: string[],
  myOfferTags: string[],
  theirWantTags: string[],
  theirOfferTags: string[]
): Promise<{ myTag: string; theirTag: string; score: number } | null> {
  // Nothing to compare on one side or the other -- skip the API call
  // entirely rather than wasting a request on an impossible match.
  if ((myWantTags.length === 0 && myOfferTags.length === 0) ||
      (theirWantTags.length === 0 && theirOfferTags.length === 0)) {
    return null;
  }

  try {
    const completion = await getGroqClient().chat.completions.create({
      model: "openai/gpt-oss-120b", // per decisions-log.md #2 -- brief's original model was deprecated
      messages: [
        {
          role: "system",
          content:
            "You compare two people's skills to find the SINGLE most related pair " +
            "between what one person wants/offers and what the other offers/wants. " +
            'Respond with ONLY a JSON object: {"myTag": "...", "theirTag": "...", "score": N} ' +
            "where score is 0-30 (30 = very closely related, e.g. baking/cooking; " +
            "0 = not related at all). If nothing is meaningfully related, respond " +
            'with exactly: {"related": false}. No explanation, no markdown, just the raw JSON.',
        },
        {
          role: "user",
          content: `My wants: ${JSON.stringify(myWantTags)}. My offers: ${JSON.stringify(myOfferTags)}. Their wants: ${JSON.stringify(theirWantTags)}. Their offers: ${JSON.stringify(theirOfferTags)}.`,
        },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content || "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.related && parsed.score > 0) {
      return { myTag: parsed.myTag, theirTag: parsed.theirTag, score: parsed.score };
    }

    return null; // AI decided nothing was actually related
  } catch (error) {
    // Same graceful-fallback principle as Phase 2's suggest-tags route --
    // if the AI call fails, this candidate is simply excluded from the
    // AI tier rather than breaking the whole matches request.
    console.error("AI relatedness error:", error);
    return null;
  }
}

const PAGE_SIZE = 6;
const MAX_TOTAL = 30; // hard cap: 5 pages of 6

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const offset = parseInt(req.query.offset as string) || 0;

    const allListings = await Listing.find({ status: "active" });

    const myListings = allListings.filter((l) => l.userId.toString() === req.userId);
    const otherListings = allListings.filter((l) => l.userId.toString() !== req.userId);

    const myWantTags = myListings.filter((l) => l.type === "want").flatMap((l) => l.skillTags);
    const myOfferTags = myListings.filter((l) => l.type === "offer").flatMap((l) => l.skillTags);

    const listingsByUser = groupListingsByUser(otherListings);

    const exactMatches = await getExactMatches(myWantTags, myOfferTags, listingsByUser);
    const exactMatchUserIds = new Set(exactMatches.map((m) => m.userId));
    const aiPool = getAiCandidatePool(myWantTags, myOfferTags, listingsByUser, exactMatchUserIds);

    // The absolute ceiling for this request -- never show more than
    // MAX_TOTAL total, and never try to read past the real exact-match
    // list or AI pool, whichever is smaller.
    const totalAvailable = Math.min(exactMatches.length + aiPool.length, MAX_TOTAL);

    const pageResults: any[] = [];

    // Walk through this page's slice (offset to offset+PAGE_SIZE),
    // pulling from exactMatches first, then spilling into the AI pool
    // only once exactMatches is exhausted.
    for (let i = offset; i < Math.min(offset + PAGE_SIZE, totalAvailable); i++) {
      if (i < exactMatches.length) {
        // This index is still within the exact-match list.
        const match = exactMatches[i];
        pageResults.push({
          userId: match.userId,
          score: match.score,
          matchType: "exact",
          matchedTags: match.matchedTags,
          listings: match.listings,
        });
      } else {
        // This index has moved past exact matches, into the AI pool.
        const aiIndex = i - exactMatches.length;
        const candidate = aiPool[aiIndex];

        if (candidate) {
          const relatedness = await getAiRelatedness(
            myWantTags,
            myOfferTags,
            candidate.theirWantTags,
            candidate.theirOfferTags
          );

          if (relatedness) {
            pageResults.push({
              userId: candidate.userId,
              score: relatedness.score,
              matchType: "related",
              matchedTags: [relatedness.myTag, relatedness.theirTag],
              listings: candidate.listings,
            });
          }
          // If relatedness is null (AI found nothing related, or the
          // call failed), we simply don't include this candidate --
          // same graceful-degradation principle as Phase 2.
        }
      }
    }

    const hasMore = offset + PAGE_SIZE < totalAvailable;

    // Batch-fetch names for everyone on this page in ONE query --
    // same principle as the trust-score fetch in getExactMatches,
    // avoiding a separate database call per candidate.
    const pageUserIds = pageResults.map((m) => m.userId);
    const pageUsers = await User.find({ _id: { $in: pageUserIds } }).select("name");
    const nameByUserId: Record<string, string> = {};
    pageUsers.forEach((u) => {
      nameByUserId[(u._id as any).toString()] = u.name;
    });

    const enrichedResults = pageResults.map((m) => ({
      ...m,
      name: nameByUserId[m.userId] || "Unknown User",
    }));

    res.status(200).json({
      matches: enrichedResults,
      hasMore,
      nextOffset: offset + PAGE_SIZE,
    });
  } catch (error) {
    console.error("Matching error:", error);
    res.status(500).json({ error: "Something went wrong finding matches." });
  }
});

export default router;