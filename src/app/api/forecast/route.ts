import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLatestForecast, generateForecast } from "@/lib/forecast-engine";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forecast = await getLatestForecast(user.id);
    return NextResponse.json({ forecast });
  } catch (error) {
    console.error("Forecast GET error:", error);
    return NextResponse.json({ error: "Failed to load forecast" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forecast = await generateForecast(user.id);
    return NextResponse.json({ forecast });
  } catch (error) {
    console.error("Forecast POST error:", error);
    return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
  }
}
