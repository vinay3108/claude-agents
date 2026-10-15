import { z } from 'zod'
import type { LeetCodeBadge, LeetCodePublicProfile } from './types'

const LEETCODE_ORIGIN = 'https://leetcode.com'

export const PUBLIC_PROFILE_QUERY = `
  query getPublicProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile { realName userAvatar ranking reputation countryName company school }
      badges { id displayName icon }
    }
    userContestRanking(username: $username) {
      rating
      globalRanking
      attendedContestsCount
      topPercentage
    }
  }
`

const nullableString = z.string().nullish()

const matchedUserSchema = z.object({
  username: z.string().min(1),
  profile: z.object({
    realName: nullableString,
    userAvatar: nullableString,
    ranking: z.number().nullish(),
    reputation: z.number().nullish(),
    countryName: nullableString,
    company: nullableString,
    school: nullableString,
  }),
  badges: z
    .array(z.object({ id: z.coerce.string(), displayName: z.string(), icon: nullableString }))
    .nullish(),
})

const contestSchema = z.object({
  rating: z.number(),
  globalRanking: z.number(),
  attendedContestsCount: z.number(),
  topPercentage: z.number().nullish(),
})

const responseSchema = z.object({
  matchedUser: matchedUserSchema.nullish(),
  userContestRanking: contestSchema.nullish(),
})

const blankToNull = (value: string | null | undefined): string | null => (value?.trim() ? value.trim() : null)

/** LeetCode returns some icons as site-relative paths; only https results are kept. */
function toHttpsUrl(value: string | null | undefined): string | null {
  const raw = blankToNull(value)
  if (!raw) return null
  try {
    const url = new URL(raw, LEETCODE_ORIGIN)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/** Maps the raw GraphQL `data` to the app's profile model. Null when the user does not exist. */
export function parsePublicProfile(data: unknown): LeetCodePublicProfile | null {
  const parsed = responseSchema.safeParse(data)
  if (!parsed.success) throw new Error('LeetCode returned an unexpected profile format')

  const user = parsed.data.matchedUser
  if (!user) return null

  const contest = parsed.data.userContestRanking
  const badges: LeetCodeBadge[] = (user.badges ?? []).map((b) => ({
    id: b.id,
    name: b.displayName,
    iconUrl: toHttpsUrl(b.icon),
  }))

  return {
    username: user.username,
    realName: blankToNull(user.profile.realName),
    avatarUrl: toHttpsUrl(user.profile.userAvatar),
    ranking: user.profile.ranking ?? null,
    reputation: user.profile.reputation ?? 0,
    country: blankToNull(user.profile.countryName),
    company: blankToNull(user.profile.company),
    school: blankToNull(user.profile.school),
    badgeCount: badges.length,
    badges,
    contest: contest
      ? {
          rating: Math.round(contest.rating),
          globalRanking: contest.globalRanking,
          attended: contest.attendedContestsCount,
          topPercentage: contest.topPercentage ?? null,
        }
      : null,
  }
}
