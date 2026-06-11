import { redirect } from "next/navigation";

// Device management moved into Settings. Keep the route as a redirect so any
// bookmarks or old links land in the right place. (The server actions in
// ./actions.js are still used by DeviceManager, now rendered under Settings.)
export default function DevicePage() {
  redirect("/settings");
}
