import { useEffect } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  blobUrl: string | null;
  onDownload: () => void;
};

export function PdfPreviewDialog({ open, onOpenChange, title, blobUrl, onDownload }: Props) {
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[min(96vw,920px)] max-w-[920px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3 pr-12">
          <div className="min-w-0">
            <DialogTitle className="truncate font-mono text-sm">{title}</DialogTitle>
            <DialogDescription className="text-xs">
              Preview only — use Download if you need the file.
            </DialogDescription>
          </div>
          <Button type="button" size="sm" className="shrink-0 gap-1.5" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted/40">
          {blobUrl ? (
            <iframe title={title} src={blobUrl} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Nothing to preview
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
