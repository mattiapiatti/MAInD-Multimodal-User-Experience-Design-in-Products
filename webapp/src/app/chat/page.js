import { requireOnboardedUser } from "@/lib/auth/guard";
import { getOnboarding } from "@/lib/data/onboarding";
import Chat from "@/components/chat/Chat";

export const metadata = { title: "Talk to Kai" };

export default async function ChatPage() {
  const user = await requireOnboardedUser();
  const profile = await getOnboarding(user.id);
  const name = profile?.preferredName || user.name || "";
  return <Chat name={name} />;
}
