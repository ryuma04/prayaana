import { VendorDetail } from "@/components/ops/VendorDetail";

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VendorDetail id={id} />;
}
