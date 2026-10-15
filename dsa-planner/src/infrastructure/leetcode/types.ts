export interface LeetCodeUserStats {
  totalSolved: number
  easySolved: number
  mediumSolved: number
  hardSolved: number
  totalSubmissions: number
  ranking: number | null
}

export interface LeetCodeTopicStat {
  tagName: string
  tagSlug: string
  problemsSolved: number
}

export interface LeetCodeContestInfo {
  rating: number
  ranking: number
  attendedContestsCount: number
}

export interface LeetCodeManualEntry {
  username: string
  totalSolved: number
  easySolved: number
  mediumSolved: number
  hardSolved: number
}

export interface LeetCodeRecentSubmission {
  id: string
  title: string
  titleSlug: string
  timestamp: string
  lang: string
}

export interface LeetCodeSubmissionDetails {
  code: string
  lang: string
  runtime: string
  memory: string
  difficulty: string
  title: string
  titleSlug: string
}

export interface LeetCodeBadge {
  id: string
  name: string
  /** Absolute https URL, or null when LeetCode gave an unusable value. */
  iconUrl: string | null
}

export interface LeetCodePublicContest {
  /** Rounded contest rating. */
  rating: number
  globalRanking: number
  attended: number
  /** "Top X%" as LeetCode shows it. */
  topPercentage: number | null
}

/** Public LeetCode profile data, as shown on leetcode.com/u/<username>. */
export interface LeetCodePublicProfile {
  username: string
  realName: string | null
  avatarUrl: string | null
  ranking: number | null
  reputation: number
  country: string | null
  company: string | null
  school: string | null
  badgeCount: number
  badges: LeetCodeBadge[]
  contest: LeetCodePublicContest | null
}
