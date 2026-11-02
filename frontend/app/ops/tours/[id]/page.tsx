import { TourDetail } from "@/components/ops/TourDetail";

export default async function TourPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TourDetail id={id} />;
}
