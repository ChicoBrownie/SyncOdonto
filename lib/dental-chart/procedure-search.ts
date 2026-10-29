export function normalizeProcedureText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim()
}

function editDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index)
  for (let column = 1; column <= right.length; column++) {
    let previous = rows[0]
    rows[0] = column
    for (let row = 1; row <= left.length; row++) {
      const old = rows[row]
      rows[row] = Math.min(rows[row] + 1, rows[row - 1] + 1, previous + (left[row - 1] === right[column - 1] ? 0 : 1))
      previous = old
    }
  }
  return rows[left.length]
}

export function searchProcedures<T extends { name: string; description: string | null }>(items: T[], search: string) {
  const query = normalizeProcedureText(search)
  if (!query) return { matches: items, suggested: false, canCreate: false }
  const usefulTerms = query.split(" ").filter(term => !["a", "as", "o", "os", "de", "do", "da", "dos", "das", "em", "e", "para", "com"].includes(term))
  const terms = usefulTerms.length ? usefulTerms : query.split(" ")
  const direct = items.filter(item => {
    const haystack = normalizeProcedureText(`${item.name} ${item.description || ""}`)
    return haystack.includes(query) || terms.every(term => haystack.split(" ").some(word => word.startsWith(term)))
  })
  if (direct.length) return { matches: direct, suggested: false, canCreate: false }

  const similar = items.map(item => {
    const words = normalizeProcedureText(item.name).split(" ")
    const distances = terms.map(term => Math.min(...words.map(word => {
      if (word.startsWith(term)) return 0
      const limit = term.length >= 5 ? 2 : 1
      const distance = editDistance(term, word)
      return distance <= limit ? distance : 99
    })))
    return { item, score: distances.reduce((sum, distance) => sum + distance, 0), valid: distances.every(distance => distance < 99) }
  }).filter(result => result.valid).sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, "pt-BR"))
  return { matches: similar.slice(0, 6).map(result => result.item), suggested: similar.length > 0, canCreate: query.length >= 2 }
}
