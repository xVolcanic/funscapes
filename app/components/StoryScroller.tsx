"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const chapters = [
  {
    label: "Outdoor thrills",
    title: "The day starts in the open air.",
    copy: "Climb, spin, splash or take in the skyline. The park balances signature thrills with gentler ways for families to play side by side.",
    image: "/funscapes-overview.jpg",
    alt: "Concept overview of the outdoor attractions at Funscapes Two Rivers",
  },
  {
    label: "Play for everyone",
    title: "There is always another way to play.",
    copy: "From energetic rides to indoor arcades, VR, bumper cars and soft play, every age and every kind of weather has an answer.",
    image: "/funscapes-day.jpg",
    alt: "Aerial concept view of Funscapes rides and family play areas",
  },
  {
    label: "Into the evening",
    title: "Stay for the lights—and the moments between.",
    copy: "When the skyline glows, the destination shifts pace: one more ride, an easy meal and time together before heading home.",
    image: "/funscapes-night.jpg",
    alt: "Night-time concept view of illuminated attractions at Funscapes Two Rivers",
  },
];

export function StoryScroller() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observers = stepRefs.current.map((step, index) => {
      if (!step) return null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(index);
        },
        { rootMargin: "-34% 0px -34% 0px", threshold: 0 },
      );
      observer.observe(step);
      return observer;
    });

    return () => observers.forEach((observer) => observer?.disconnect());
  }, []);

  return (
    <section className="story" id="experience" aria-labelledby="story-title">
      <div className="story-visual">
        <div className="story-images">
          {chapters.map((chapter, index) => (
            <Image
              key={chapter.image}
              className={index === active ? "is-active" : ""}
              src={chapter.image}
              alt={chapter.alt}
              width={1600}
              height={960}
            />
          ))}
          <div className="story-vignette" />
          <p className="story-counter"><span>0{active + 1}</span> / 03</p>
          <p className="visual-caption">Supplied architectural visualisation</p>
        </div>
        <div className="story-controls" aria-label="Experience chapters">
          {chapters.map((chapter, index) => (
            <button
              key={chapter.label}
              className={index === active ? "is-active" : ""}
              onClick={() => stepRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" })}
              aria-label={`View chapter ${index + 1}: ${chapter.label}`}
              aria-current={index === active ? "step" : undefined}
            >
              <i /><span>0{index + 1}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="story-copy">
        <div className="section-label section-label-story">
          <span>02</span>
          <p className="eyebrow">One destination. Many ways to play.</p>
        </div>
        <h2 id="story-title" className="sr-only">Explore the Funscapes experience</h2>
        {chapters.map((chapter, index) => (
          <article
            key={chapter.title}
            ref={(node) => { stepRefs.current[index] = node; }}
            className={index === active ? "story-step is-active" : "story-step"}
          >
            <p>0{index + 1} · {chapter.label}</p>
            <h3>{chapter.title}</h3>
            <p>{chapter.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
