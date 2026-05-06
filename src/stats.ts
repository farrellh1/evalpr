export function ranks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }))
  indexed.sort((a, b) => a.v - b.v)

  const out = new Array<number>(values.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) {
      j++
    }
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) {
      out[indexed[k].i] = avgRank
    }
    i = j + 1
  }
  return out
}

function pearson(x: number[], y: number[]): number {
  const n = x.length
  let sx = 0
  let sy = 0
  for (let i = 0; i < n; i++) {
    sx += x[i]
    sy += y[i]
  }
  const mx = sx / n
  const my = sy / n
  let num = 0
  let dx2 = 0
  let dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? 0 : num / denom
}

export function spearman(x: number[], y: number[]): number {
  if (x.length !== y.length) {
    throw new Error('spearman: input length mismatch')
  }
  if (x.length === 0) {
    throw new Error('spearman: empty input')
  }
  return pearson(ranks(x), ranks(y))
}
