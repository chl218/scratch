import Link from "next/link";
import { Uploader } from "@/components/Uploader";

export const metadata = { title: "Upload pictures" };

// F1: upload Reference Pictures. Tags, credit and source apply to the whole batch.
export default function LibraryUploadPage() {
  return (
    <div className="max-w-3xl space-y-3">
      <Uploader endpoint="/api/admin/photos" withDetails label="Upload pictures" />
      <p className="text-sm text-loupe">
        Uploaded pictures appear in <Link href="/admin/library" className="font-semibold text-graphite underline underline-offset-4">Pictures</Link>,
        newest first.
      </p>
    </div>
  );
}
