"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { LoadingIntro } from "./LoadingIntro";
import { ModelStage } from "./ModelStage";
import { SiteMenu } from "./SiteMenu";

const HEADER_SOCIALS = [
  ["LinkedIn", "https://www.linkedin.com/company/funscapes/", "/social-linkedin.png"],
  ["Instagram", "https://www.instagram.com/funscapes_indoors/", "/social-instagram.png"],
  ["YouTube", "https://www.youtube.com/@funscapesgroup", "/social-youtube.png"],
  ["Facebook", "https://www.facebook.com/FunscapesGroup", "/social-facebook.png"],
] as const;

export function HeroExperience() {
  const [modelProgress, setModelProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);

  const handleReady = useCallback(() => {
    setModelProgress(100);
    setModelReady(true);
  }, []);

  return (
    <>
      <LoadingIntro progress={modelProgress} ready={modelReady} />

      <section className="hero" id="top">
        <nav className="site-nav" aria-label="Primary navigation">
          <a className="hero-brand" href="#top" aria-label="Funscapes home">
            <Image
              className="hero-logo"
              src="/funscapes-logo.png"
              alt="Funscapes"
              width={1502}
              height={722}
              priority
            />
          </a>

          <div className="site-nav-actions">
            <div className="site-social-links" aria-label="Funscapes social channels">
              {HEADER_SOCIALS.map(([label, href, icon]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Funscapes on ${label}`}
                  title={label}
                >
                  <Image src={icon} alt="" width={24} height={24} />
                </a>
              ))}
            </div>
            <a
              className="site-contact-link"
              href="mailto:info@funscapes.net"
              aria-label="Email Funscapes"
            >
              Contact
            </a>
            <SiteMenu />
          </div>
        </nav>

        <div
          className="hero-model"
          id="park-map"
          role="region"
          aria-label="Interactive map of Funscapes Two Rivers"
        >
          <ModelStage onProgress={setModelProgress} onReady={handleReady} />
        </div>

      </section>
    </>
  );
}
