import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "csv-imports";

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data: buckets, error: listError } = await admin.storage.listBuckets();

  if (listError) {
    throw new Error(`listBuckets failed: ${listError.message}`);
  }

  const exists = buckets?.some((b) => b.name === BUCKET);

  if (!exists) {
    const { error: createError } = await admin.storage.createBucket(BUCKET, {
      public: false,
    });
    if (createError) {
      throw new Error(`createBucket failed: ${createError.message}`);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fileName = request.nextUrl.searchParams.get("filename") || "import.csv";
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${Date.now()}-${safeName}`;

    const admin = createAdminClient();

    await ensureBucket(admin);

    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      const msg = error?.message ?? "No data returned";
      console.error("createSignedUploadUrl error:", msg);
      return NextResponse.json(
        { error: `Storage error: ${msg}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Presign route error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
