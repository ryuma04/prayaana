import { NextRequest, NextResponse } from "next/server";
import { travelGuruService } from "@/components/travel-guru/services/travelGuruService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, city = "Bengaluru" } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Call dynamic travel guru service (supports live weather, geocoding for any city, and rich intent engine)
    const response = await travelGuruService.queryLocalGuru(message, city);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Travel Guru API error:", error);
    return NextResponse.json(
      { error: "Failed to generate travel response", details: error?.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "Bengaluru";

  try {
    const cityInfo = await travelGuruService.resolveCityInfo(city);
    return NextResponse.json(cityInfo);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch city details", details: error?.message },
      { status: 500 }
    );
  }
}
