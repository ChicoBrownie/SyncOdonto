import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function consumeRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const keyHash = createHash("sha256").update(key).digest("hex")
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) throw new Error(`Rate limit indisponível: ${error.message}`)
  return data === true
}
