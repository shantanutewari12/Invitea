import { greeting } from "@/copy/en";

import { GUEST_NAME_PLACEHOLDER } from "./constants";

/**
 * Fill the greeting template for a guest. Without a name (the common link) a
 * generic greeting is used. Plain split/join avoids `$&`-style replacement
 * patterns in guest names.
 */
export function renderGreeting(template: string, guestName?: string | null): string {
  const name = guestName?.trim() ? guestName.trim() : greeting.genericGuestName;
  return template.split(GUEST_NAME_PLACEHOLDER).join(name);
}
