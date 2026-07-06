import Image from "next/image";

export function AppLogo() {
  return (
    <Image
      src="/assets/logo/app-icon.png"
      alt="My Games logo"
      width={64}
      height={64}
      priority
      unoptimized
      className="h-16 w-16 shrink-0 rounded-[18px] object-contain"
    />
  );
}
