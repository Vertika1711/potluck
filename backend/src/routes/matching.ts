import { Router } from "express";
import Listing from "../models/Listing.js";
import User from "../models/User.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

import OpenAI from "openai";

const router = Router();

function groupListingsByUser(listings: any[]) {
  const grouped: Record<string, any[]> = {};
  for (const listing of listings) {
    const id = listing.userId.toString();
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(listing);
  }
  return grouped;
}

interface MatchCard {
  userId: string;
  listingId: string;
  title: string;
  description: string;
  type: "offer" | "want";
  skillTags: string[];
  matchedTags: string[];
}

async function getExactMatches(
  myWantTags: string[],
  myOfferTags: string[],
  listingsByUser: Record<string, any[]>
) {
  const candidates: {
    userId: string;
    score: number;
    matchedListings: Omit<MatchCard, "userId">[];
  }[] = [];

  for (const [candidateUserId, candidateListings] of Object.entries(listingsByUser)) {
    const theirOfferListings = candidateListings.filter((l) => l.type === "offer");
    const theirWantListings = candidateListings.filter((l) => l.type === "want");

    const theirOfferTags = theirOfferListings.flatMap((l) => l.skillTags);
    const theirWantTags = theirWantListings.flatMap((l) => l.skillTags);

    const forwardMatches = myWantTags.filter((tag) => theirOfferTags.includes(tag));
    const backwardMatches = myOfferTags.filter((tag) => theirWantTags.includes(tag));

    const exactScore = (forwardMatches.length + backwardMatches.length) * 50;

    if (exactScore > 0) {
      const matchedListings: Omit<MatchCard, "userId">[] = [];

      for (const listing of theirOfferListings) {
        const matchedTags = listing.skillTags.filter((tag: string) => forwardMatches.includes(tag));
        if (matchedTags.length > 0) {
          matchedListings.push({
            listingId: listing._id.toString(),
            title: listing.title,
            description: listing.description,
            type: listing.type,
            skillTags: listing.skillTags,
            matchedTags,
          });
        }
      }

      for (const listing of theirWantListings) {
        const matchedTags = listing.skillTags.filter((tag: string) => backwardMatches.includes(tag));
        if (matchedTags.length > 0) {
          matchedListings.push({
            listingId: listing._id.toString(),
            title: listing.title,
            description: listing.description,
            type: listing.type,
            skillTags: listing.skillTags,
            matchedTags,
          });
        }
      }

      candidates.push({
        userId: candidateUserId,
        score: exactScore,
        matchedListings,
      });
    }
  }

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

  withTrust.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.trustScore - a.trustScore;
  });

  return withTrust;
}

function flattenExactMatches(
  exactMatches: { userId: string; matchedListings: Omit<MatchCard, "userId">[] }[]
): MatchCard[] {
  return exactMatches.flatMap((match) =>
    match.matchedListings.map((listing) => ({
      userId: match.userId,
      ...listing,
    }))
  );
}

// NEW: builds the set of listing IDs that already contributed to an
// EXACT match -- used to exclude just those specific listings from AI
// consideration, not the whole person. Fixes a real gap found during
// testing: a person who has ONE exact-matching listing (e.g. a cooking
// tag overlap) was previously excluded from AI scoring ENTIRELY, even
// though a completely different listing of theirs (e.g. "Pottery")
// might be genuinely AI-related to something else of mine. Now only
// the specific listings that already matched exactly are excluded --
// their other listings remain eligible for AI relatedness.
function getMatchedListingIds(
  exactMatches: { matchedListings: Omit<MatchCard, "userId">[] }[]
): Set<string> {
  const ids = new Set<string>();
  for (const match of exactMatches) {
    for (const listing of match.matchedListings) {
      ids.add(listing.listingId);
    }
  }
  return ids;
}

// Builds the pool of candidates worth checking for AI relatedness --
// now scoped to INDIVIDUAL LISTINGS not already claimed by an exact
// match, rather than excluding an entire person just because ONE of
// their listings happened to match exactly. A person can legitimately
// appear in exactMatches (via one listing) AND still be checked here
// (via a different, exact-match-free listing of theirs).
function getAiCandidatePool(
  listingsByUser: Record<string, any[]>,
  matchedListingIds: Set<string>
) {
  const pool: {
    userId: string;
    theirWantTags: string[];
    theirOfferTags: string[];
    theirOfferListings: any[];
    theirWantListings: any[];
  }[] = [];

  for (const [candidateUserId, candidateListings] of Object.entries(listingsByUser)) {
    // Only keep listings that DIDN'T already contribute to an exact
    // match -- this is the key change from the previous per-person
    // exclusion.
    const remainingListings = candidateListings.filter(
      (l) => !matchedListingIds.has(l._id.toString())
    );

    const theirOfferListings = remainingListings.filter((l) => l.type === "offer");
    const theirWantListings = remainingListings.filter((l) => l.type === "want");
    const theirOfferTags = theirOfferListings.flatMap((l) => l.skillTags);
    const theirWantTags = theirWantListings.flatMap((l) => l.skillTags);

    // If a candidate's only listings were already exact-matched,
    // remainingListings will be empty and theirWantTags/theirOfferTags
    // will both be empty -- naturally excluded here, same as before.
    if (theirWantTags.length > 0 || theirOfferTags.length > 0) {
      pool.push({
        userId: candidateUserId,
        theirWantTags,
        theirOfferTags,
        theirOfferListings,
        theirWantListings,
      });
    }
  }

  pool.sort((a, b) => a.userId.localeCompare(b.userId));

  return pool;
}

function getGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

async function getAiRelatedness(
  myWantTags: string[],
  myOfferTags: string[],
  theirWantTags: string[],
  theirOfferTags: string[]
): Promise<{ myTag: string; theirTag: string; score: number } | null> {
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

    return null;
  } catch (error) {
    console.error("AI relatedness error:", error);
    return null;
  }
}

function buildAiMatchCard(
  candidateUserId: string,
  myWantTags: string[],
  myTag: string,
  theirTag: string,
  theirOfferListings: any[],
  theirWantListings: any[]
): MatchCard | null {
  const fromOffers = theirOfferListings.find((l: any) => l.skillTags.includes(theirTag));
  if (fromOffers) {
    return {
      userId: candidateUserId,
      listingId: fromOffers._id.toString(),
      title: fromOffers.title,
      description: fromOffers.description,
      type: fromOffers.type,
      skillTags: fromOffers.skillTags,
      matchedTags: [theirTag],
    };
  }

  const fromWants = theirWantListings.find((l: any) => l.skillTags.includes(theirTag));
  if (fromWants) {
    return {
      userId: candidateUserId,
      listingId: fromWants._id.toString(),
      title: fromWants.title,
      description: fromWants.description,
      type: fromWants.type,
      skillTags: fromWants.skillTags,
      matchedTags: [theirTag],
    };
  }

  return null;
}

const PAGE_SIZE = 9;
const MAX_TOTAL = 45;

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
    const exactCards = flattenExactMatches(exactMatches);

    // CHANGED: was exactMatchUserIds (excluded whole people). Now
    // matchedListingIds (excludes only the specific listings that
    // already matched exactly), per the fix.
    const matchedListingIds = getMatchedListingIds(exactMatches);
    const aiPool = getAiCandidatePool(listingsByUser, matchedListingIds);

    const cardsForPage: MatchCard[] = [];

    const exactSliceEnd = Math.min(offset + PAGE_SIZE, exactCards.length);
    for (let i = offset; i < exactSliceEnd; i++) {
      cardsForPage.push(exactCards[i]);
    }

    if (cardsForPage.length < PAGE_SIZE) {
      const aiPoolStartIndex = Math.max(0, offset - exactCards.length);

      let aiIndex = aiPoolStartIndex;
      while (cardsForPage.length < PAGE_SIZE && aiIndex < aiPool.length) {
        const candidate = aiPool[aiIndex];
        aiIndex++;

        const relatedness = await getAiRelatedness(
          myWantTags,
          myOfferTags,
          candidate.theirWantTags,
          candidate.theirOfferTags
        );

        if (relatedness) {
          const card = buildAiMatchCard(
            candidate.userId,
            myWantTags,
            relatedness.myTag,
            relatedness.theirTag,
            candidate.theirOfferListings,
            candidate.theirWantListings
          );
          if (card) {
            cardsForPage.push(card);
          }
        }
      }
    }

    const exactRemaining = exactCards.length > offset + PAGE_SIZE;
    const aiPoolTried = Math.max(0, offset + PAGE_SIZE - exactCards.length);
    const aiRemaining = aiPoolTried < aiPool.length;
    const hasMore = (exactRemaining || aiRemaining) && offset + PAGE_SIZE < MAX_TOTAL;

    const pageUserIds = [...new Set(cardsForPage.map((c) => c.userId))];
    const pageUsers = await User.find({ _id: { $in: pageUserIds } }).select("name");
    const nameByUserId: Record<string, string> = {};
    pageUsers.forEach((u) => {
      nameByUserId[(u._id as any).toString()] = u.name;
    });

    const enrichedCards = cardsForPage.map((c) => ({
      ...c,
      posterName: nameByUserId[c.userId] || "Unknown User",
    }));

    res.status(200).json({
      matches: enrichedCards,
      hasMore,
      nextOffset: offset + PAGE_SIZE,
    });
  } catch (error) {
    console.error("Matching error:", error);
    res.status(500).json({ error: "Something went wrong finding matches." });
  }
});

export default router;