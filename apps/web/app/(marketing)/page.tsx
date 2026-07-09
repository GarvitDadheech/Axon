"use client";

import { useAuth } from "@/components/providers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LandingBackground } from "@/components/landing/background";
import { LandingNavbar } from "@/components/landing/navbar";
import { HeroScene } from "@/components/landing/hero-scene";
import { DeveloperScene } from "@/components/landing/developer-scene";
import { MarketplaceScene } from "@/components/landing/marketplace-scene";
import { BenefitsScene } from "@/components/landing/benefits-scene";
import { ExecutionScene } from "@/components/landing/execution-scene";
import { CtaScene } from "@/components/landing/cta-scene";

export default function LandingPage() {
  const { ready, authenticated, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) router.replace("/dashboard");
  }, [ready, authenticated, router]);

  if (!ready || authenticated) return null;

  return (
    <div className="min-h-screen text-[#e8e6e0] selection:bg-emerald-500/20">
      <LandingBackground />
      <LandingNavbar />
      <main>
        <HeroScene onLogin={login} ready={ready} />
        <DeveloperScene />
        <MarketplaceScene />
        <BenefitsScene />
        <ExecutionScene />
        <CtaScene onLogin={login} ready={ready} />
      </main>
    </div>
  );
}
