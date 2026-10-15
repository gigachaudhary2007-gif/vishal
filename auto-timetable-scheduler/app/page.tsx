"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, RotateCcw } from "lucide-react";
import PopcornText from "./popcorn-text";

const REVEAL_AT = 5.0;
const VIDEO_URL = "https://thinkingods.com/demos/mako-hero/hero.mp4";

export default function WelcomePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [depth, setDepth] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const reveal = useCallback(() => setRevealed(true), []);
  const restart = useCallback(() => {
    setRevealed(false);
    setDepth(0);
    const video = videoRef.current;
    if (!video) return;
    video.removeAttribute("data-playing");
    video.currentTime = 0;
    void video.play().catch(reveal);
  }, [reveal]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    const watchdog = window.setTimeout(reveal, 9000);
    if (query.matches) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = Math.max(0, (video.duration || REVEAL_AT) - 0.1);
        video.pause();
      }
      reveal();
    } else {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        void video.play().catch(reveal);
      }
    }
    return () => {
      query.removeEventListener("change", sync);
      window.clearTimeout(watchdog);
    };
  }, [reveal]);

  useEffect(() => {
    const section = document.querySelector(".dive-log");
    if (!section || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add("log-inview");
        observer.disconnect();
      }
    }, { threshold: 0.18 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const updateVideo = (video: HTMLVideoElement) => {
    setDepth(Math.min(200, Math.round((video.currentTime / REVEAL_AT) * 200)));
    if (video.currentTime >= REVEAL_AT) reveal();
  };

  return (
    <main className={`chronos-welcome${revealed ? " is-revealed" : ""}${reducedMotion ? " is-reduced" : ""}`}>
      <section className={`welcome-hero${revealed ? " is-revealed" : ""}${reducedMotion ? " is-reduced" : ""}`} aria-label="Welcome to Chronos">
        <video ref={videoRef} className="welcome-video" src={VIDEO_URL} muted playsInline preload="auto" onPlay={(event) => event.currentTarget.setAttribute("data-playing", "true")} onLoadedData={(event) => { try { const video = event.currentTarget; const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1; const context = canvas.getContext("2d"); if (context) { context.drawImage(video, video.videoWidth * 0.03, video.videoHeight * 0.08, video.videoWidth * 0.04, video.videoHeight * 0.04, 0, 0, 1, 1); const [r, g, b] = context.getImageData(0, 0, 1, 1).data; document.documentElement.style.setProperty("--ocean-bg", `rgb(${r}, ${g}, ${b})`); document.documentElement.style.setProperty("--ocean-ghost", `rgb(${Math.min(255,r+9)}, ${Math.min(255,g+13)}, ${Math.min(255,b+18)})`); } } catch { /* Cross-origin video keeps the CSS fallback palette. */ } if (!reducedMotion) void event.currentTarget.play().catch(reveal); }} onTimeUpdate={(event) => updateVideo(event.currentTarget)} onEnded={reveal} onError={reveal} />
        <div className="hero-veil" aria-hidden="true" />
        <div className="hero-word" aria-hidden="true">CHRONOS</div>
        <header className="welcome-nav rv" style={{ "--d": 0 } as CSSProperties}>
          <a className="brand" href="#top" aria-label="Chronos home"><span className="brand-fin">◢<i /></span><span>CHRONOS</span></a>
          <nav aria-label="Main navigation"><a href="#log">OVERVIEW</a><a href="#log">PLANNER</a><a href="#log">FEATURES</a><a href="#log">ABOUT</a></nav>
          <a className="nav-login" href="/login">SIGN IN</a>
          <button className="nav-pill" onClick={() => router.push("/dashboard")}>OPEN PLANNER <ArrowUpRight size={13} /></button>
        </header>
        <aside className="depth-gauge" aria-label={`Planning depth ${String(depth).padStart(3,"0")} meters`}><span className="depth-label">DEPTH</span><div className="depth-track"><i style={{ top: `${Math.min(100, depth / 2)}%` }} /></div><span className="depth-number">{String(depth).padStart(3,"0")}m</span></aside>
        <div className="welcome-copy">
          <p className="welcome-eyebrow rv" style={{ "--d": 2 } as CSSProperties}>ACADEMIC PLANNING · YOUR WEEK, IN RHYTHM</p>
          <PopcornText as="h1" className="rv" style={{ "--d": 3 } as CSSProperties}>Make room<br />for <em>what matters.</em></PopcornText>
          <p className="welcome-lede rv" style={{ "--d": 4 } as CSSProperties}>A calmer way to bring courses, faculty, rooms and your week into focus. Set your preferences, then build a timetable that works.</p>
          <div className="welcome-actions rv" style={{ "--d": 5 } as CSSProperties}><button className="primary-cta" onClick={() => router.push("/dashboard")}>GO TO DASHBOARD <span><ArrowRight size={16} /></span></button><a className="text-link" href="#log">Explore Chronos ↗</a></div>
        </div>
        <div className="welcome-dock" aria-label="Chronos overview">
          {[['thumb-eye.jpg','COURSES','Plan your week'],['thumb-jaw.jpg','PREFERENCES','Make it yours'],['thumb-tail.jpg','TIMETABLE','See it clearly']].map(([image,label,value], index) => <div className="dock-cell rv" style={{ "--d": index + 6 } as CSSProperties} key={label}><img src={`https://thinkingods.com/demos/mako-hero/${image}`} alt=""/><div><small>{label}</small><strong>{value}</strong></div></div>)}
          <div className="dock-cell dock-meta rv" style={{ "--d": 9 } as CSSProperties}><div><small>CHRONOS · YOUR PLANNING SPACE</small><strong>Focus, in rhythm.</strong></div><button className="replay-pill" onClick={restart}><RotateCcw size={12} /> replay</button></div>
        </div>
      </section>

      <section className="dive-log" id="log">
        <div className="log-heading"><p className="log-kicker"><b>02</b> DIVE LOG — WHY CHRONOS</p><div><h2>Built around your week,<br /><em>ready when you are.</em></h2><p className="log-intro">Chronos brings the moving parts of academic planning into one clear view, so you can spend less time coordinating and more time learning.</p></div></div>
        <div className="log-grid">
          <article className="log-card feature-card feature-courses"><small>FEATURE 01 · COURSE SETUP</small><PopcornText as="h3">Every course<br />in its place.</PopcornText><p>Keep course hours, faculty and rooms together, ready for your weekly plan.</p><div className="feature-art course-art" aria-hidden="true"><i/><i/><i/><b>COURSE LIST</b></div><a className="feature-link" href="/dashboard">Manage courses <ArrowUpRight size={14} /></a></article>
          <article className="log-card feature-card feature-preferences"><small>FEATURE 02 · PREFERENCES</small><PopcornText as="h3">A plan that fits.</PopcornText><p>Set your availability and preferred class windows before scheduling.</p><div className="feature-art preference-art" aria-hidden="true"><span>M T W T F</span><i/><i/><i/><i/><i/><b /></div><a className="feature-link" href="/dashboard">Set preferences <ArrowUpRight size={14} /></a></article>
          <article className="log-card feature-card feature-schedule"><small>FEATURE 03 · SMART SCHEDULING</small><PopcornText as="h3">Find your week’s rhythm.</PopcornText><p>Generate a timetable that brings your courses into a clear, workable week.</p><div className="feature-art schedule-art" aria-hidden="true"><i/><i/><i/><i/><b>YOUR WEEK</b></div><a className="feature-link" href="/dashboard">Build a timetable <ArrowUpRight size={14} /></a></article>
          <article className="log-card feature-card feature-clarity"><small>FEATURE 04 · WEEKLY VIEW</small><PopcornText as="h3">See the whole picture.</PopcornText><p>Review classes by day and period, with faculty and rooms close at hand.</p><div className="feature-art clarity-art" aria-hidden="true"><i/><i/><i/><b /></div><a className="feature-link" href="/dashboard">Explore your week <ArrowUpRight size={14} /></a></article>
        </div>
        <div className="stats-band"><div><small>COURSES</small><strong>All <i>together</i></strong><span className="ruler"><i/></span></div><div><small>PLANNING</small><strong>Made <i>personal</i></strong><span className="temp-bar"><i/></span></div><div><small>WORKFLOW</small><strong>One clear <i>view</i></strong><span className="tooth-row">▴ ▴ ▴ ▴ ▴ ▴</span></div><div><small>YOUR WEEK</small><strong className="coral">In rhythm</strong><span className="curve">⌁</span></div></div>
        <div className="closing-line"><p>Set your courses. Shape your week.<br /><em>Find your rhythm.</em></p><button className="primary-cta" onClick={() => router.push("/dashboard")}>GO TO DASHBOARD <span><ArrowRight size={16} /></span></button></div>
      </section>
    </main>
  );
}
