import { requireOnboardedUser } from "@/lib/auth/guard";
import { listDevices } from "@/lib/data/devices";
import Screen from "@/components/shell/Screen";
import DeviceManager from "@/components/device/DeviceManager";

export const metadata = { title: "Device" };

export default async function DevicePage() {
  const user = await requireOnboardedUser();
  // Plain serializable objects for the client component.
  const rows = await listDevices(user.id);
  const devices = rows.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    hardwareId: d.hardwareId,
    pairedAt:
      d.pairedAt instanceof Date ? d.pairedAt.toISOString() : d.pairedAt,
  }));

  return (
    <Screen title="Device">
      <DeviceManager devices={devices} />
    </Screen>
  );
}
