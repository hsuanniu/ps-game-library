import Image from "next/image";

export function AppLogo() {
  return (
    <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,#12263A,#09121D)] shadow-md shadow-black/15">
      <Image
        src="/logo.png"
        alt="App logo"
        width={58}
        height={58}
        priority
        unoptimized
        className="relative h-[66px] w-[66px] object-contain"
      />
      <span className="pointer-events-none absolute bottom-[7px] h-[2px] w-8 rounded-full bg-blue-400/45 shadow-[0_0_10px_rgba(59,130,246,0.36)]" />
    </span>
  );
}
