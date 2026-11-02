import { DestinationDetail } from "@/components/traveler/DestinationDetail";

export default async function DestinationPage({ params }: { params: Promise<{ destination: string }> }) {
  const { destination } = await params;
  return <DestinationDetail id={destination} />;
}
