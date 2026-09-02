"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./SiteMenu.module.css";

type Panel = "group" | "contact" | "social";

const SOCIAL_LINKS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/funscapes/", icon: "/social-linkedin.png" },
  { label: "Instagram", href: "https://www.instagram.com/funscapes_indoors/", icon: "/social-instagram.png" },
  { label: "YouTube", href: "https://www.youtube.com/@funscapesgroup", icon: "/social-youtube.png" },
  { label: "Facebook", href: "https://www.facebook.com/FunscapesGroup", icon: "/social-facebook.png" },
] as const;

export function SiteMenu({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("group");
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const close = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);

    setOpen(false);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setMounted(false);
      setPanel("group");
      trigger.current?.focus();
    }, 360);
  }, []);

  const show = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    setPanel("group");
    setMounted(true);
    setOpen(true);
  };

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() =>
      dialog.current?.querySelector<HTMLElement>("button")?.focus(),
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return close();
      if (event.key !== "Tab" || !dialog.current) return;

      const items = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (!dialog.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, mounted]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const panelButton = (value: Panel, label: string) => (
    <button
      type="button"
      data-active={panel === value}
      onClick={() => setPanel(value)}
      aria-expanded={panel === value}
      aria-controls="menu-detail"
    >
      <span>{label}</span>
      <b aria-hidden="true">{panel === value ? "−" : "+"}</b>
    </button>
  );

  return (
    <>
      <button
        ref={trigger}
        className={[styles.trigger, className].filter(Boolean).join(" ")}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={show}
      >
        <span className={styles.triggerMark} aria-hidden="true"><i /><i /></span>
        Menu
      </button>

      {mounted && createPortal(
        <div
          className={styles.overlay}
          data-open={open}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialog}
            id="site-menu"
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Funscapes menu"
            data-open={open}
          >
            <header className={styles.header}>
              <div className={styles.menuBrand}>
                <Image
                  className={styles.menuLogo}
                  src="/funscapes-logo.png"
                  alt="Funscapes"
                  width={1502}
                  height={722}
                />
                <span>Entertainment development &amp; operations</span>
              </div>
              <button className={styles.close} type="button" onClick={close} aria-label="Close menu">
                <span aria-hidden="true">×</span>
                Close
              </button>
            </header>

            <div className={styles.body}>
              <nav className={styles.navigation} aria-label="Main menu">
                <a href="#park-map" onClick={close}>
                  <span>Explore the park</span>
                  <b aria-hidden="true">↘</b>
                </a>
                {panelButton("group", "Funscapes Group")}
                {panelButton("contact", "Contact & enquiries")}
                {panelButton("social", "Social channels")}
              </nav>

              <aside id="menu-detail" className={styles.panel} aria-label="Menu details" aria-live="polite">
                {panel === "group" ? (
                  <>
                    <p className={styles.kicker}>Funscapes Group</p>
                    <h2>We design, build and operate places made for play.</h2>
                    <p className={styles.copy}>
                      From feasibility and concept development to facility operations, equipment and
                      technical support, Funscapes brings entertainment projects to life.
                    </p>
                    <ul className={styles.capabilities} aria-label="Group capabilities">
                      <li>Market analysis &amp; feasibility</li>
                      <li>Venue design &amp; development</li>
                      <li>Operations &amp; technical support</li>
                    </ul>
                    <a className={styles.panelAction} href="mailto:info@funscapes.net?subject=Partnership%20enquiry">
                      Discuss a project <span aria-hidden="true">↗</span>
                    </a>
                  </>
                ) : panel === "contact" ? (
                  <>
                    <p className={styles.kicker}>Contact &amp; enquiries</p>
                    <h2>Start with the right conversation.</h2>
                    <div className={styles.contactList}>
                      <a href="mailto:info@funscapes.net"><span>Group enquiries</span><strong>info@funscapes.net</strong></a>
                      <a href="tel:+254707603091"><span>Kenya · Two Rivers</span><strong>+254 707 603 091</strong></a>
                      <a href="tel:+97137512924"><span>UAE office</span><strong>+971 3 751 2924</strong></a>
                      <a href="tel:+971565250359"><span>UAE mobile</span><strong>+971 56 525 0359</strong></a>
                    </div>
                    <address className={styles.address}>
                      Funscapes Entertainment · 3rd Floor, Remal Mall · Sanaiya, Al Ain · P.O. Box 87774, UAE
                    </address>
                  </>
                ) : (
                  <>
                    <p className={styles.kicker}>Social channels</p>
                    <h2>Updates from across Funscapes.</h2>
                    <div className={styles.socialList}>
                      {SOCIAL_LINKS.map((social) => (
                        <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer">
                          <span className={styles.socialIdentity}>
                            <Image src={social.icon} alt="" width={28} height={28} />
                            <span>{social.label}</span>
                          </span>
                          <b aria-hidden="true">↗</b>
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </aside>
            </div>

            <footer className={styles.utility}>
              <div><span>Business enquiries</span><a href="mailto:info@funscapes.net">info@funscapes.net</a></div>
              <div><span>Kenya</span><strong>Two Rivers, Nairobi</strong></div>
              <div><span>Group office</span><strong>Al Ain, UAE</strong></div>
              <div className={styles.utilitySocials}>
                {SOCIAL_LINKS.map((social) => (
                  <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer">
                    {social.label}
                  </a>
                ))}
              </div>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
