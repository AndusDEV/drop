import { IconsLinuxLogo, IconsWindowsLogo, IconsMacLogo, IconsAndroidLogo } from "#components";
import { Platform } from "~/prisma/client/enums";

export const PLATFORM_ICONS = {
  [Platform.Linux]: IconsLinuxLogo,
  [Platform.Windows]: IconsWindowsLogo,
  [Platform.macOS]: IconsMacLogo,
  [Platform.Android]: IconsAndroidLogo
};
