export function whatsappProposalUrl(phone: string, content: string) {
  const digits = phone.replace(/\D/g, "")
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
  if (!/^55\d{10,11}$/.test(number)) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(content)}`
}

export function emailProposalUrl(email: string, content: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return null
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent("Proposta de tratamento")}&body=${encodeURIComponent(content)}`
}
