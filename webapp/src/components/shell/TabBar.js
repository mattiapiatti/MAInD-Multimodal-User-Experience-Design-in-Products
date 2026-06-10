"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TabBar.module.css";
import { HomeIcon, PulseIcon, DeviceIcon, SettingsIcon } from "./icons";

const TABS = [
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/insights", label: "Insights", Icon: PulseIcon },
  { href: "/device", label: "Device", Icon: DeviceIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label="Main navigation">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.tab} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon className={styles.icon} aria-hidden="true" />
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
