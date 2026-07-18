import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { useInventory } from "@/components/app/inventory-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, edits this category id/label; otherwise creates new. */
  category?: { id: string; label: string; description?: string } | null;
  onSaved?: (category: { id: string; label: string }) => void;
};

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: Props) {
  const { addCategory, updateCategory, removeCategory, parts } = useInventory();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const editing = Boolean(category);

  useEffect(() => {
    if (!open) return;
    setLabel(category?.label ?? "");
    setDescription(category?.description ?? "");
  }, [open, category]);

  const inUse =
    editing && category
      ? parts.some((p) => p.category === category.label)
      : false;

  const save = () => {
    const name = label.trim();
    if (!name) {
      toast.error("Enter a category name");
      return;
    }
    if (editing && category) {
      const saved = updateCategory(category.id, {
        label: name,
        description,
      });
      if (!saved) {
        toast.error("Could not update category");
        return;
      }
      toast.success("Category updated");
      onOpenChange(false);
      onSaved?.(saved);
      return;
    }
    const created = addCategory(name, description);
    if (!created) {
      toast.error("Category already exists");
      return;
    }
    toast.success("Category created");
    onOpenChange(false);
    onSaved?.(created);
  };

  const remove = () => {
    if (!category) return;
    if (inUse) {
      toast.error("Move or reassign parts before deleting this category");
      return;
    }
    if (!removeCategory(category.id)) {
      toast.error("Could not delete category");
      return;
    }
    toast.success("Category deleted");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Rename this category. Parts in it are updated automatically."
              : "Create a new inventory category for grouping parts."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-label">Name</Label>
            <Input
              id="cat-label"
              value={label}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
              placeholder="e.g. Hydraulic hoses"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description (optional)</Label>
            <Input
              id="cat-desc"
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setDescription(e.target.value)
              }
              placeholder="Short note on this category"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {editing ? (
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={inUse}
              title={inUse ? "Category still has parts" : "Delete category"}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
