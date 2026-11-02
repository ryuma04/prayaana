import { VendorReply } from "@/components/vendor/VendorReply";

export const metadata = { title: "Change request" };

export default async function VendorTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <VendorReply token={token} />;
}
