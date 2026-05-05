"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { deleteEmployee, type EmployeeRow } from "@/app/_actions/employees"
import { EmployeeDialog } from "./EmployeeDialog"

export function EmployeesPanel({
  initialEmployees,
  currentEmployeeId,
}: {
  initialEmployees: EmployeeRow[]
  currentEmployeeId: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<EmployeeRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<EmployeeRow | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!deletingId) return
    startTransition(async () => {
      const result = await deleteEmployee(deletingId.id)
      if (!result.ok) {
        const msg =
          result.error === "has_submissions"
            ? "This employee has submissions on record. Deletion is currently blocked."
            : result.error === "cannot_delete_self"
              ? "You can't delete your own account."
              : "Delete failed."
        toast.error(msg)
        return
      }
      toast.success("Employee deleted.")
      setDeletingId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialEmployees.length} employee
          {initialEmployees.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-[1%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialEmployees.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No employees yet. Add one or upload a list.
                </TableCell>
              </TableRow>
            )}
            {initialEmployees.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.full_name}</TableCell>
                <TableCell className="font-mono text-sm">{e.phone}</TableCell>
                <TableCell>{e.employee_code}</TableCell>
                <TableCell>
                  {e.role === "admin" ? (
                    <Badge variant="secondary" className="border border-blue-300/50 bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                      Admin
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Field sales</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Edit"
                      onClick={() => setEditing(e)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete"
                      onClick={() => setDeletingId(e)}
                      disabled={e.id === currentEmployeeId}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmployeeDialog
        open={adding}
        onOpenChange={setAdding}
        employee={null}
      />
      <EmployeeDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        employee={editing}
      />

      <Dialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete employee?</DialogTitle>
            <DialogDescription>
              This will remove <strong>{deletingId?.full_name}</strong>. Their
              past submissions stay visible. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingId(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
