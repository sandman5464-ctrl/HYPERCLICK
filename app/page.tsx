import { BrandStudio } from "@/components/brand-studio";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col px-6 py-20 sm:py-28">
      <header className="mb-16 text-center">
        <h1 className="font-display m-0 text-[4.75rem] leading-none tracking-[-0.04em] text-paper">
          KOVA
        </h1>
        <p className="mt-5 text-[15px] font-light tracking-[0.01em] text-mute">
          Brand-grade motion in one click.
        </p>
      </header>
      <BrandStudio />
    </main>
  );
}
