import type { MetadataRoute } from "next"
export default function manifest(): MetadataRoute.Manifest {
  return { name: "SyncOdonto", short_name: "SyncOdonto", description: "Atendimento odontológico. É necessário estar conectado à internet.", start_url: "/atendimento", scope: "/", display: "standalone", background_color: "#ffffff", theme_color: "#0d9488", lang: "pt-BR", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] }
}
