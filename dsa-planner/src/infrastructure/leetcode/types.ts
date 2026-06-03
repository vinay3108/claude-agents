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
