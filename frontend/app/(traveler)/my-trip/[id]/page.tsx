import { Suspense } from "react";
import { TripDashboard } from "@/components/traveler/TripDashboard";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <TripDashboard id={id} />
    </Suspense>
  );
}
