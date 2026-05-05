import { requireUser } from "@/lib/auth/dal"
import { Header } from "@/components/auth/Header"

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  return (
    <div className="flex flex-1 flex-col">
      <Header user={user} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
