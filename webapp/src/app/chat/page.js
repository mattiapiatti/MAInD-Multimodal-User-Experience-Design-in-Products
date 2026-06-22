import { requireOnboardedUser } from "@/lib/auth/guard";
import { getOnboarding } from "@/lib/data/onboarding";
import { listDevices } from "@/lib/data/devices";
import Chat from "@/components/chat/Chat";

export const metadata = { title: "Talk to Kai" };

export default async function ChatPage() {
  const user = await requireOnboardedUser();
  const [profile, devices] = await Promise.all([
    getOnboarding(user.id),
    listDevices(user.id),
  ]);
  const name = profile?.preferredName || user.name || "";
  const paired = devices.some((d) => d.status === "active");
  return <Chat name={name} paired={paired} />;
}
