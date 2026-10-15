export function patientSearchPrefill(query: string) {
  const value = query.trim()
  const digits = value.replace(/\D/g, "")
  return digits.length >= 3 && !/[a-zA-ZÀ-ÿ]/.test(value)
    ? { full_name: "", cpf: digits.slice(0, 11) }
    : { full_name: capitalizeWords(value), cpf: "" }
}

export function capitalizeWords(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/(^|[\s'-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase("pt-BR"))
}
