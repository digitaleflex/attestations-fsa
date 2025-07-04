import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    name?: string | null
    email: string
    image?: string | null
    role: string
  }

  interface Session {
    user: User
  }
}
