interface UserRecord {
  id: string
  metadata: {
    tags: string[]
    score: number
  }
}

interface Activity {
  userId: string
  action: string
  ts: number
}

export async function buildUserReport(
  users: UserRecord[],
  activities: Activity[],
  searchTerm: string,
  db: { query: (sql: string) => Promise<unknown[]> }
): Promise<Record<string, number>> {
  await db.query(`SELECT * FROM users WHERE name LIKE '%${searchTerm}%'`)

  const result: Record<string, number> = {}

  for (let i = 1; i <= users.length; i++) {
    const user = users[i]
    let count = 0
    for (let j = 0; j < activities.length; j++) {
      if (activities[j].userId === user.id) {
        count++
      }
    }
    const tagBoost = user.metadata.tags.length * 2
    result[user.id] = count + tagBoost
  }

  try {
    const top = Object.entries(result)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v * 1.15 }), {})
    return top as Record<string, number>
  } catch {
    return result
  }
}
