"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createEmployee,
  updateEmployee,
  type EmployeeRow,
} from "@/app/_actions/employees"
import { employeeBaseSchema } from "@/lib/schemas/employee"

type FormValues = {
  full_name: string
  phone_digits: string
  employee_code: string
  role: "field_sales" | "admin"
}

const editFormSchema = employeeBaseSchema
  .omit({ phone: true })
  .extend({
    phone_digits: employeeBaseSchema.shape.phone.transform((v) =>
      v.replace(/^\+91/, "")
    ),
  })

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeRow | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(employee)

  const form = useForm<FormValues>({
    defaultValues: {
      full_name: employee?.full_name ?? "",
      phone_digits: employee?.phone?.replace(/^\+91/, "") ?? "",
      employee_code: employee?.employee_code ?? "",
      role: employee?.role ?? "field_sales",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: employee?.full_name ?? "",
        phone_digits: employee?.phone?.replace(/^\+91/, "") ?? "",
        employee_code: employee?.employee_code ?? "",
        role: employee?.role ?? "field_sales",
      })
    }
  }, [open, employee, form])

  function submit(values: FormValues) {
    const phoneOk = /^[6-9]\d{9}$/.test(values.phone_digits)
    if (!phoneOk) {
      form.setError("phone_digits", { message: "Enter 10 digits, starting with 6–9" })
      return
    }
    const payload = {
      full_name: values.full_name.trim(),
      phone: `+91${values.phone_digits}`,
      employee_code: values.employee_code.trim(),
      role: values.role,
    }
    startTransition(async () => {
      const result = isEdit
        ? await updateEmployee({ id: employee!.id, ...payload })
        : await createEmployee(payload)
      if (!result.ok) {
        const msg =
          result.error === "duplicate"
            ? "Phone or employee code already exists."
            : result.error === "validation_failed"
              ? "Some fields are invalid."
              : "Save failed."
        toast.error(msg)
        return
      }
      toast.success(isEdit ? "Employee updated." : "Employee added.")
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            Phone numbers are normalised to +91XXXXXXXXXX.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(submit)}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              {...form.register("full_name", { required: true, maxLength: 100 })}
              placeholder="Jane Doe"
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="phone_digits">Mobile number</Label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                +91
              </span>
              <Input
                id="phone_digits"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                placeholder="9876543210"
                className="rounded-l-none"
                {...form.register("phone_digits", {
                  required: true,
                  pattern: /^[6-9]\d{9}$/,
                  setValueAs: (v) => String(v).replace(/\D/g, "").slice(0, 10),
                })}
              />
            </div>
            {form.formState.errors.phone_digits && (
              <p className="text-xs text-destructive">
                {form.formState.errors.phone_digits.message ??
                  "Enter 10 digits"}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="employee_code">Employee code</Label>
            <Input
              id="employee_code"
              {...form.register("employee_code", { required: true, maxLength: 30 })}
              placeholder="EMP001"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select
              value={form.watch("role")}
              onValueChange={(v) =>
                form.setValue("role", v as "field_sales" | "admin")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="field_sales">Field sales</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
