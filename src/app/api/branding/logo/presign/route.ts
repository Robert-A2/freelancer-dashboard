import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "brand-logos";
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "svg", "webp"]);

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw new Error(`listBuckets failed: ${listError.message}`);

  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    // Public: a client viewing the Pay page (never logged in) needs to load
    // this image directly by URL, with no signed/expiring link involved.
    const { error: createError } = await admin.storage.createBucket(BUCKET, { public: true });
    if (createError) throw new Error(`createBucket failed: ${createError.message}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fileName = request.nextUrl.searchParams.get("filename") || "logo.png";
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "Logo must be a PNG, JPG, SVG, or WebP image." }, { status: 400 });
    }

    // One logo per user — reusing the same path means a re-upload replaces
    // the old file instead of leaving orphaned images behind.
    const storagePath = `${user.id}/logo.${ext}`;

    const admin = createAdminClient();
    await ensureBucket(admin);

    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: true });
    if (error || !data) {
      const msg = error?.message ?? "No data returned";
      console.error("createSignedUploadUrl error:", msg);
      return NextResponse.json({ error: `Storage error: ${msg}` }, { status: 500 });
    }

    const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
      publicUrl: publicUrlData.publicUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Logo presign route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
