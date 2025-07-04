// app/api/auth/[...all]/route.ts
import { getAuth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

// Création d'un gestionnaire asynchrone pour les routes
const handler = async () => {
  const auth = await getAuth()
  return toNextJsHandler(auth.handler)
}

export const { GET, POST } = await handler()
