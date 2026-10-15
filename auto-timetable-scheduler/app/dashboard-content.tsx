
"use client";

import LogoutButton from "@/components/logout-button";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Controller as ScrollMagicController } from "scrollmagic";
import SidebarRobot from "./sidebar-robot";
import DashboardPageHeader from "./dashboard/page-header";
import PreferencesPanel from "./scheduling/preferences-panel";
import WorkloadCard from "./scheduling/workload-card";
import { createCalendarIcs } from "./scheduling/insights";
import {
  DAYS,
  DEFAULT_PREFERENCES,
  PERIODS,
  PREFERENCES_STORAGE_KEY,
  COURSES_STORAGE_KEY,
  TIMETABLE_STORAGE_KEY,
  isSchedulingPreferences,
  type AssistantContext,
  type Course,
  type ScheduleMove,
  type SchedulingPreferences,
  type TimetableEntry,
} from "./scheduling/types";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

gsap.registerPlugin(useGSAP);

const INITIAL_COURSES: Course[] = [
  {
    id: "1",
    name: "FOCP",
    hours_per_week: 4,
    faculty: "Faculty A",
    room: "Lab 01",
    color: "#8c7cf0",
  },
  {
    id: "2",
    name: "BEE",
    hours_per_week: 3,
    faculty: "Faculty B",
    room: "Room 204",
    color: "#e9a45c",
  },
  {
    id: "3",
    name: "Engineering Chemistry",
    hours_per_week: 3,
    faculty: "Faculty C",
    room: "Room 106",
    color: "#53b6a0",
  },
  {
    id: "4",
    name: "Biology for Engineers",
    hours_per_week: 3,
    faculty: "Faculty D",
    room: "Room 302",
    color: "#df8499",
  },
  {
    id: "5",
    name: "Digital Logic",
    hours_per_week: 4,
    faculty: "Faculty E",
    room: "Room 208",
    color: "#6d9de8",
  },
];

const API_ENDPOINT = "http://localhost:8000/generate";

type GenerationConflict = {
  courses: string[];
  constraints: string[];
  suggestions: string[];
};

type PendingSchedule = {
  timetable: TimetableEntry[];
  fitSummary: string[];
  move: ScheduleMove | null;
  changes: string[];
};

type CourseField = "name" | "hours_per_week" | "faculty" | "room";
type CourseFieldErrors = Partial<Record<CourseField, string>>;

function getCourseFieldErrors(courses: Course[]): Record<string, CourseFieldErrors> {
  const nameCounts = new Map<string, number>();
  courses.forEach((course) => {
    const name = course.name.trim().toLocaleLowerCase();
    if (name) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  });

  return Object.fromEntries(
    courses.map((course) => {
      const errors: CourseFieldErrors = {};
      const normalizedName = course.name.trim().toLocaleLowerCase();
      if (!normalizedName) {
        errors.name = "Enter a course name.";
      } else if ((nameCounts.get(normalizedName) ?? 0) > 1) {
        errors.name = "Course names must be unique.";
      }
      if (
        !Number.isInteger(course.hours_per_week) ||
        course.hours_per_week < 1 ||
        course.hours_per_week > 30
      ) {
        errors.hours_per_week = "Enter 1–30 periods per week.";
      }
      if (!course.faculty.trim()) errors.faculty = "Assign a faculty member.";
      if (!course.room.trim()) errors.room = "Assign a room.";
      return [course.id, errors];
    })
  );
}

function isCourse(value: unknown): value is Course {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "hours_per_week" in value &&
    typeof value.hours_per_week === "number" &&
    Number.isInteger(value.hours_per_week) &&
    value.hours_per_week >= 1 &&
    value.hours_per_week <= 30 &&
    "faculty" in value &&
    typeof value.faculty === "string" &&
    "room" in value &&
    typeof value.room === "string" &&
    "color" in value &&
    typeof value.color === "string"
  );
}

function isTimetableEntry(value: unknown): value is TimetableEntry {
  const dayIsValid =
    typeof value === "object" &&
    value !== null &&
    "day" in value &&
    (typeof value.day === "number"
      ? Number.isInteger(value.day) && value.day >= 0 && value.day < DAYS.length
      : typeof value.day === "string" && DAYS.includes(value.day));
  return (
    typeof value === "object" &&
    value !== null &&
    "course" in value &&
    typeof value.course === "string" &&
    dayIsValid &&
    "slot" in value &&
    typeof value.slot === "number" &&
    Number.isInteger(value.slot) &&
    value.slot >= 0 &&
    value.slot < PERIODS.length &&
    (!("day_name" in value) ||
      (typeof value.day_name === "string" && DAYS.includes(value.day_name))) &&
    (!("faculty" in value) || typeof value.faculty === "string") &&
    (!("room" in value) || typeof value.room === "string") &&
    (!("day_name" in value) || typeof value.day_name === "string")
  );
}

const NAVIGATION = [
  {
    name: "Overview",
    label: "Today",
    icon: LayoutDashboard,
    description: "Your academic overview",
  },
  {
    name: "Timetable",
    label: "Calendar",
    icon: CalendarDays,
    description: "Your weekly schedule",
  },
  {
    name: "Courses",
    label: "Courses",
    icon: BookOpen,
    description: "Manage your courses",
  },
  {
    name: "Faculty",
    label: "Faculty",
    icon: Users,
    description: "Faculty directory",
  },
  {
    name: "Rooms",
    label: "Rooms",
    icon: DoorOpen,
    description: "Classroom availability",
  },
  {
    name: "Constraints",
    label: "Preferences",
    icon: Settings2,
    description: "Scheduling preferences",
  },
];

const PAGE_CONTENT: Record<
  string,
  { eyebrow: string; title: string; description: string }
> = {
  Overview: {
    eyebrow: "YOUR CAMPUS, IN SYNC",
    title: "Your week, in rhythm",
    description:
      "Bring classes, rooms, and the time between them into one clear plan.",
  },
  Timetable: {
    eyebrow: "A CLEARER WEEK",
    title: "Your weekly timetable",
    description:
      "See every class, room, and faculty assignment at a glance.",
  },
  Courses: {
    eyebrow: "COURSE CATALOGUE",
    title: "Your courses",
    description:
      "Set course hours and assignments once. Chronos keeps the week organised.",
  },
  Faculty: {
    eyebrow: "PEOPLE BEHIND THE PLAN",
    title: "Teaching team",
    description: "Keep faculty assignments easy to find and simple to review.",
  },
  Rooms: {
    eyebrow: "SPACE FOR EVERY CLASS",
    title: "Campus rooms",
    description: "See where courses meet and keep room assignments in order.",
  },
  Constraints: {
    eyebrow: "MAKE THE PLAN FIT",
    title: "Your preferences",
    description:
      "Set availability and preferred class windows before building your schedule.",
  },
};

function getDayIndex(day: number | string): number {
  if (typeof day === "number") {
    return day >= 0 && day <= 4 ? day : day >= 1 && day <= 5 ? day - 1 : -1;
  }

  const value = String(day).toLowerCase().trim();

  const aliases: Record<string, number> = {
    mon: 0,
    monday: 0,
    tue: 1,
    tues: 1,
    tuesday: 1,
    wed: 2,
    wednesday: 2,
    thu: 3,
    thur: 3,
    thurs: 3,
    thursday: 3,
    fri: 4,
    friday: 4,
  };

  if (value in aliases) return aliases[value];

  const parsed = Number(value);
  if (!Number.isNaN(parsed)) {
    if (parsed >= 0 && parsed <= 4) return parsed;
    if (parsed >= 1 && parsed <= 5) return parsed - 1;
  }

  return -1;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2
          data-scroll-reveal-item
          className="text-xl font-semibold tracking-tight text-[#242424] sm:text-2xl"
        >
          {title}
        </h2>
        {description && (
          <p
            data-scroll-reveal-item
            className="mt-2 text-sm leading-6 text-[#635d53] sm:text-[15px]"
          >
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const pageTransitionOrigin = useRef<{ x: number; y: number } | null>(null);
  const shouldAnimatePageOpen = useRef(false);

  const [activePage, setActivePage] = useState("Overview");
  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [preferences, setPreferences] =
    useState<SchedulingPreferences>(DEFAULT_PREFERENCES);
  const [pendingSchedule, setPendingSchedule] =
    useState<PendingSchedule | null>(null);
  const [fitSummary, setFitSummary] = useState<string[]>([]);
  const [generationConflict, setGenerationConflict] =
    useState<GenerationConflict | null>(null);
  const [repairSourceIndex, setRepairSourceIndex] = useState(0);
  const [repairTargetDay, setRepairTargetDay] = useState(0);
  const [repairTargetSlot, setRepairTargetSlot] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [storageLoadFailed, setStorageLoadFailed] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generationReviewOpen, setGenerationReviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [generated, setGenerated] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [fluidSmokeReady, setFluidSmokeReady] = useState(false);
  const generationInProgress = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFluidSmokeReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
        const savedCourses = localStorage.getItem(COURSES_STORAGE_KEY);
        const savedTimetable = localStorage.getItem(TIMETABLE_STORAGE_KEY);

        if (savedPreferences) {
          const parsed: unknown = JSON.parse(savedPreferences);
          if (!isSchedulingPreferences(parsed)) {
            throw new Error("Saved scheduling preferences are invalid.");
          }
          setPreferences(parsed);
        }
        if (savedCourses) {
          const parsed: unknown = JSON.parse(savedCourses);
          if (!Array.isArray(parsed) || !parsed.every(isCourse)) {
            throw new Error("Saved courses are invalid.");
          }
          setCourses(parsed);
        }
        if (savedTimetable) {
          const parsed: unknown = JSON.parse(savedTimetable);
          if (!Array.isArray(parsed) || !parsed.every(isTimetableEntry)) {
            throw new Error("Saved timetable is invalid.");
          }
          setTimetable(parsed);
          setGenerated(parsed.length > 0);
        }
      } catch (caughtError) {
        setStorageLoadFailed(true);
        setStorageError(
          caughtError instanceof Error
            ? `${caughtError.message} Please correct or clear the saved data before continuing.`
            : "Saved planner data could not be loaded."
        );
      } finally {
        setStorageReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady || storageLoadFailed) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
        localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
        localStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(timetable));
        setPreferencesSaved(true);
        setStorageError("");
      } catch {
        setPreferencesSaved(false);
        setStorageError(
          "Planner settings could not be saved in this browser. Check available storage and try again."
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [courses, preferences, storageLoadFailed, storageReady, timetable]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now);
      setSelectedDate((value) => value ?? now);
    };

    updateClock();
    const interval = window.setInterval(updateClock, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        shouldAnimatePageOpen.current = false;
        pageTransitionOrigin.current = null;
        return;
      }

      const pageContent = pageContentRef.current;
      if (pageContent && shouldAnimatePageOpen.current) {
        const origin = pageTransitionOrigin.current;
        gsap.fromTo(
          pageContent,
          {
            autoAlpha: 0.35,
            scale: 0.975,
            transformOrigin: origin
              ? `${origin.x}px ${origin.y}px`
              : "50% 50%",
          },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.48,
            ease: "power3.out",
            clearProps: "opacity,visibility,transform,transformOrigin",
            onComplete: () => {
              pageContent.style.removeProperty("transform-origin");
              shouldAnimatePageOpen.current = false;
              pageTransitionOrigin.current = null;
            },
          }
        );
      }

      const revealTargets = root.current?.querySelectorAll(".reveal");
      if (revealTargets?.length) {
        gsap.fromTo(
          revealTargets,
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            stagger: 0.065,
            ease: "power2.out",
            clearProps: "all",
          }
        );
      }
    },
    { scope: root, dependencies: [activePage] }
  );

  useEffect(() => {
    if (activePage !== "Overview" || !root.current) return;

    const targets = Array.from(
      root.current.querySelectorAll<HTMLElement>(
        ".scroll-reveal:not(.dashboard-metric-card):not(.dashboard-feature-card), .feature-card:not(.dashboard-feature-card)"
      )
    );
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const animations: gsap.core.Timeline[] = [];
    const contentObservers: MutationObserver[] = [];
    const focusListeners: Array<{
      target: HTMLElement;
      onFocusIn: () => void;
      onFocusOut: (event: FocusEvent) => void;
    }> = [];
    let controller: ScrollMagicController | null = null;

    const clearScenes = () => {
      controller?.destroy(true);
      controller = null;
      focusListeners.forEach(({ target, onFocusIn, onFocusOut }) => {
        target.removeEventListener("focusin", onFocusIn);
        target.removeEventListener("focusout", onFocusOut);
      });
      focusListeners.length = 0;
      contentObservers.forEach((observer) => observer.disconnect());
      contentObservers.length = 0;
      animations.forEach((animation) => animation.kill());
      animations.length = 0;
      gsap.set(
        [
          ...targets,
          ...targets.flatMap((target) =>
            Array.from(
              target.querySelectorAll<HTMLElement>(
                "[data-scroll-reveal-item], [data-scroll-reveal-icon], [data-scroll-reveal-indicator]"
              )
            )
          ),
        ],
        { clearProps: "opacity,transform,clipPath,filter,boxShadow" }
      );
    };

    let cancelled = false;

    const createScenes = async () => {
      const { default: ScrollMagic } = await import("scrollmagic");
      if (cancelled || motionPreference.matches || controller) return;

      const nextController = new ScrollMagic.Controller({
        loglevel: 0,
        refreshInterval: 0,
      });
      controller = nextController;

      targets.forEach((target) => {
        const getContent = () =>
          Array.from(
            target.querySelectorAll<HTMLElement>(
            "[data-scroll-reveal-item], [data-scroll-reveal-icon], [data-scroll-reveal-indicator]"
            )
          );
        let content = getContent();
        let timeline: gsap.core.Timeline;
        let hasEntered = false;
        const animationIndex = animations.length;
        const contentStart = 0.54;
        const contentStagger = 0.035;

        const buildTimeline = () => {
          const nextTimeline = gsap.timeline({ paused: true });
          nextTimeline.fromTo(
            target,
            { autoAlpha: 0, y: 20, scale: 0.99, immediateRender: false },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.48,
              ease: "power3.out",
            },
            0
          );

          content.forEach((element, index) => {
            const position = contentStart + index * contentStagger;

            if (element.hasAttribute("data-scroll-reveal-indicator")) {
              nextTimeline.fromTo(
                element,
                {
                  scaleX: 0,
                  transformOrigin: "left center",
                  immediateRender: false,
                },
                { scaleX: 1, duration: 0.38, ease: "power2.out" },
                position
              );
              return;
            }

            if (element.hasAttribute("data-scroll-reveal-icon")) {
              nextTimeline.fromTo(
                element,
                {
                  autoAlpha: 0,
                  y: 5,
                  scale: 0.82,
                  rotation: -4,
                  immediateRender: false,
                },
                {
                  autoAlpha: 1,
                  y: 0,
                  scale: 1,
                  rotation: 0,
                  duration: 0.34,
                  ease: "back.out(1.5)",
                },
                position
              );
              return;
            }

            nextTimeline.fromTo(
              element,
              {
                autoAlpha: 0,
                y: 6,
                clipPath: "inset(0 100% 0 0 round 2px)",
                immediateRender: false,
              },
              {
                autoAlpha: 1,
                y: 0,
                clipPath: "inset(0 0% 0 0 round 2px)",
                duration: 0.34,
                ease: "power2.out",
              },
              position
            );
          });

          if (content.length > 0) {
            const lastContentEnd =
              contentStart + (content.length - 1) * contentStagger + 0.38;
            nextTimeline.to(
              content,
              {
                filter: "brightness(1.07)",
                duration: 0.1,
                stagger: 0.012,
                yoyo: true,
                repeat: 1,
                ease: "sine.inOut",
              },
              lastContentEnd
            );
          }

          return nextTimeline;
        };

        timeline = buildTimeline();
        animations.push(timeline);
        const onFocusIn = () => {
          hasEntered = true;
          timeline.progress(1);
        };
        const onFocusOut = (event: FocusEvent) => {
          if (
            event.relatedTarget instanceof Node &&
            target.contains(event.relatedTarget)
          ) {
            return;
          }

          window.requestAnimationFrame(() => {
            if (target.contains(document.activeElement)) return;
            const triggerLine = window.innerHeight * 0.88;
            hasEntered = target.getBoundingClientRect().top < triggerLine;
            if (!hasEntered) {
              timeline.reverse();
            } else {
              timeline.play();
            }
          });
        };
        target.addEventListener("focusin", onFocusIn);
        target.addEventListener("focusout", onFocusOut);
        focusListeners.push({ target, onFocusIn, onFocusOut });

        const observer = new MutationObserver(() => {
          const nextContent = getContent();
          if (
            nextContent.length === content.length &&
            nextContent.every((element, index) => element === content[index])
          ) {
            return;
          }

          const shouldPlay = hasEntered || target.contains(document.activeElement);
          const previousContent = content;
          timeline.kill();
          gsap.set([target, ...previousContent], {
            clearProps: "opacity,transform,clipPath,filter,boxShadow",
          });
          content = nextContent;
          timeline = buildTimeline();
          animations[animationIndex] = timeline;
          if (shouldPlay) timeline.play();
        });
        observer.observe(target, { childList: true, subtree: true });
        contentObservers.push(observer);

        new ScrollMagic.Scene({
          triggerElement: target,
          triggerHook: 0.88,
          reverse: true,
        })
          .on("enter", (event) => {
            if (motionPreference.matches) return;
            if (event.scrollDirection === "REVERSE") {
              if (target.contains(document.activeElement)) {
                hasEntered = true;
                timeline.progress(1);
              } else {
                hasEntered = false;
                timeline.reverse();
              }
            } else {
              hasEntered = true;
              timeline.play();
            }
          })
          .addTo(nextController);
      });
    };

    const handleMotionPreferenceChange = () => {
      clearScenes();
      if (!motionPreference.matches) void createScenes();
    };

    if (!motionPreference.matches) void createScenes();
    motionPreference.addEventListener("change", handleMotionPreferenceChange);

    return () => {
      cancelled = true;
      motionPreference.removeEventListener(
        "change",
        handleMotionPreferenceChange
      );
      clearScenes();
    };
  }, [activePage]);

  function updateCourse(id: string, key: keyof Course, value: string | number) {
    setPendingSchedule(null);
    setCourses((current) =>
      current.map((course) =>
        course.id === id ? { ...course, [key]: value } : course
      )
    );
  }

  function addCourse() {
    setPendingSchedule(null);
    const newCourse: Course = {
      id: `${Date.now()}`,
      name: "New Course",
      hours_per_week: 3,
      faculty: "Faculty",
      room: "Room",
      color: "#9b91e8",
    };

    setCourses((current) => [...current, newCourse]);
    setNotice("New course added. Update its details below.");
    setError("");
  }

  function removeCourse(id: string) {
    setPendingSchedule(null);
    setCourses((current) => current.filter((course) => course.id !== id));
    setNotice("Course removed.");
    setError("");
  }

  function openGenerationReview() {
    setError("");
    setNotice("");
    setGenerationConflict(null);
    setGenerationReviewOpen(true);
  }

  function renderSetupGuide() {
    return (
      <section
        aria-labelledby="setup-progress-title"
        className="mx-auto mt-6 w-full max-w-2xl rounded-2xl border border-white/15 bg-white/[0.06] p-4 text-left sm:p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 id="setup-progress-title" className="text-sm font-semibold">
            Setup progress
          </h4>
          <span className="text-xs text-white/75">
            {coursesReady ? "Courses ready" : `${completeCourses} of ${courses.length} courses ready`}
          </span>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          <li className="flex min-w-0 items-start gap-2.5">
            <CheckCircle2
              size={17}
              className={`mt-0.5 shrink-0 ${coursesReady ? "text-[#ff9a43]" : "text-white/45"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white">
                Courses and assignments
              </p>
              <p className="mt-1 text-[11px] leading-5 text-white/75">
                {coursesReady
                  ? `${courses.length} courses have names, periods, faculty, and rooms.`
                  : "Add courses and complete each course’s periods, faculty, and room."}
              </p>
              <button
                type="button"
                onClick={() => openPage("Courses")}
                className="mt-1 text-xs font-semibold text-[#ffb166] underline decoration-white/35 underline-offset-2 hover:text-white"
              >
                {coursesReady ? "Edit courses" : "Configure courses"}
              </button>
            </div>
          </li>
          <li className="flex min-w-0 items-start gap-2.5">
            <CheckCircle2
              size={17}
              className={`mt-0.5 shrink-0 ${preferencesCustomized ? "text-[#ff9a43]" : "text-white/45"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white">
                Scheduling preferences
              </p>
              <p className="mt-1 text-[11px] leading-5 text-white/75">
                {preferencesCustomized
                  ? "Your availability and preferences are saved in this browser."
                  : "Optional: set unavailable times or preferred class windows."}
              </p>
              <button
                type="button"
                onClick={() => openPage("Constraints")}
                className="mt-1 text-xs font-semibold text-[#ffb166] underline decoration-white/35 underline-offset-2 hover:text-white"
              >
                Edit preferences
              </button>
            </div>
          </li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-xs leading-5 text-white/75">
            {generationReady
              ? "Your setup is ready. Review it before creating a schedule preview."
              : "Complete course details and resolve any availability conflicts before generating."}
          </p>
          <button
            type="button"
            onClick={openGenerationReview}
            className="min-h-10 rounded-xl bg-[#ff8a24] px-3.5 text-xs font-semibold text-[#252523] transition hover:bg-[#ffa14d] focus-visible:outline-offset-4"
          >
            Review setup
          </button>
        </div>
      </section>
    );
  }

  function describeScheduleChanges(
    previous: TimetableEntry[],
    next: TimetableEntry[]
  ): string[] {
    if (previous.length === 0) {
      return ["This is a new schedule; your current courses are not changed."];
    }
    const unmatched = [...previous];
    const changes: string[] = [];
    for (const entry of next) {
      const previousIndex = unmatched.findIndex(
        (item) =>
          item.course === entry.course &&
          getDayIndex(item.day_name ?? item.day) ===
            getDayIndex(entry.day_name ?? entry.day) &&
          Number(item.slot) === Number(entry.slot) &&
          (item.faculty ?? "") === (entry.faculty ?? "") &&
          (item.room ?? "") === (entry.room ?? "")
      );
      if (previousIndex >= 0) {
        unmatched.splice(previousIndex, 1);
      } else {
        const sourceIndex = unmatched.findIndex(
          (item) => item.course === entry.course
        );
        const source =
          sourceIndex >= 0 ? unmatched.splice(sourceIndex, 1)[0] : null;
        const from = source
          ? `${DAYS[getDayIndex(source.day_name ?? source.day)]} ${PERIODS[Number(source.slot)]}`
          : "new class";
        const to = `${DAYS[getDayIndex(entry.day_name ?? entry.day)]} ${PERIODS[Number(entry.slot)]}`;
        const assignment = [
          source && source.faculty !== entry.faculty
            ? `faculty ${source.faculty ?? "unassigned"} → ${entry.faculty ?? "unassigned"}`
            : entry.faculty
              ? `faculty ${entry.faculty}`
              : "",
          source && source.room !== entry.room
            ? `room ${source.room ?? "unassigned"} → ${entry.room ?? "unassigned"}`
            : entry.room
              ? `room ${entry.room}`
              : "",
        ]
          .filter(Boolean)
          .join(", ");
        changes.push(
          `${entry.course}: ${from} → ${to}${assignment ? ` · ${assignment}` : ""}`
        );
      }
    }
    for (const entry of unmatched) {
      changes.push(
        `${entry.course} removed from ${DAYS[getDayIndex(entry.day_name ?? entry.day)]} ${PERIODS[Number(entry.slot)]}`
      );
    }
    return changes.length
      ? changes.slice(0, 8)
      : ["The schedule remains unchanged; preferences are still satisfied."];
  }

  async function generateTimetable(move: ScheduleMove | null = null) {
    if (generationInProgress.current) return;
    if (courses.length === 0) {
      setError("Add at least one course before generating a timetable.");
      setNotice("");
      return;
    }
    if (!move && !generationReady) {
      setGenerationReviewOpen(true);
      setError(
        "Finish the highlighted course details or availability settings before generating."
      );
      setNotice("");
      return;
    }
    if (
      move &&
      move.from_day === move.to_day &&
      move.from_slot === move.to_slot
    ) {
      setError("Choose a different day or period for the class move preview.");
      setNotice("");
      return;
    }

    generationInProgress.current = true;
    setLoading(true);
    setError("");
    setNotice("");
    setGenerationConflict(null);
    setGenerationReviewOpen(false);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: courses.map((course) => ({
            name: course.name,
            hours_per_week: Number(course.hours_per_week),
            faculty: course.faculty,
            room: course.room,
          })),
          days: 5,
          slots_per_day: 6,
          preferences,
          move,
        }),
      });

      const data: unknown = await response.json();

      if (
        typeof data !== "object" ||
        data === null ||
        !("status" in data) ||
        !("message" in data)
      ) {
        throw new Error("The scheduler returned an invalid response.");
      }

      if (!response.ok) {
        const detail =
          "detail" in data && Array.isArray(data.detail)
            ? data.detail
                .map((item) =>
                  typeof item === "object" &&
                  item !== null &&
                  "msg" in item &&
                  typeof item.msg === "string"
                    ? item.msg
                    : ""
                )
                .filter(Boolean)
                .join(" ")
            : "";
        throw new Error(
          detail || `The scheduling server returned an error (${response.status}).`
        );
      }

      if (data.status !== "success") {
        if (
          "conflict" in data &&
          typeof data.conflict === "object" &&
          data.conflict !== null
        ) {
          const conflict = data.conflict;
          setGenerationConflict({
            courses:
              "courses" in conflict && Array.isArray(conflict.courses)
                ? conflict.courses.filter(
                    (course): course is string => typeof course === "string"
                  )
                : [],
            constraints:
              "constraints" in conflict && Array.isArray(conflict.constraints)
                ? conflict.constraints.filter(
                    (item): item is string => typeof item === "string"
                  )
                : [],
            suggestions:
              "suggestions" in conflict && Array.isArray(conflict.suggestions)
                ? conflict.suggestions.filter(
                    (item): item is string => typeof item === "string"
                  )
                : [],
          });
        }
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "The scheduler could not generate a timetable."
        );
      }

      if (
        !("timetable" in data) ||
        !Array.isArray(data.timetable) ||
        !data.timetable.every(isTimetableEntry)
      ) {
        throw new Error("The server response did not contain a valid timetable.");
      }

      const candidate = data.timetable;
      const summary =
        "fit_summary" in data && Array.isArray(data.fit_summary)
          ? data.fit_summary.filter(
              (item): item is string => typeof item === "string"
            )
          : [];
      setPendingSchedule({
        timetable: candidate,
        fitSummary: summary,
        move,
        changes: describeScheduleChanges(timetable, candidate),
      });
      setGenerationConflict(null);
      setNotice(
        `Preview ready: ${candidate.length} class ${candidate.length === 1 ? "period" : "periods"} placed. ${
          timetable.length > 0
            ? "Your current timetable stays in place until you replace it."
            : "Review it before adding it to your calendar."
        }`
      );
      setActivePage("Timetable");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";

      setError(
        message.includes("fetch")
          ? "Could not connect to the scheduling backend. Make sure your backend is running at http://localhost:8000."
          : message
      );
    } finally {
      setLoading(false);
      generationInProgress.current = false;
    }
  }

  function applyPendingSchedule() {
    if (!pendingSchedule) return;
    setTimetable(pendingSchedule.timetable);
    setFitSummary(pendingSchedule.fitSummary);
    setGenerated(true);
    setLastGeneratedAt(new Date());
    setNotice(
      pendingSchedule.move
        ? `${pendingSchedule.move.course} moved to ${DAYS[pendingSchedule.move.to_day]} at ${PERIODS[pendingSchedule.move.to_slot]}.`
        : "Your reviewed timetable has been applied."
    );
    setPendingSchedule(null);
    setGenerationConflict(null);
    setError("");
    setNotice(
      `Timetable updated with ${pendingSchedule.timetable.length} scheduled ${
        pendingSchedule.timetable.length === 1 ? "period" : "periods"
      }.`
    );
  }

  function downloadCalendar() {
    if (timetable.length === 0) return;
    const file = new Blob([createCalendarIcs(timetable)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "chronos-timetable.ics";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function courseColor(name: string) {
    return (
      courses.find(
        (course) => course.name.toLowerCase() === name.toLowerCase()
      )?.color ?? "#9b91e8"
    );
  }

  const filteredCourses = courses.filter((course) =>
    `${course.name} ${course.faculty} ${course.room}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const totalHours = courses.reduce(
    (total, course) => total + Number(course.hours_per_week || 0),
    0
  );

  const uniqueFaculty = new Set(
    courses.map((course) => course.faculty.trim()).filter(Boolean)
  ).size;

  const uniqueRooms = new Set(
    courses.map((course) => course.room.trim()).filter(Boolean)
  ).size;

  const facultyGroups = Array.from(
    courses.reduce((map, course) => {
      const key = course.faculty || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(course);
      return map;
    }, new Map<string, Course[]>())
  );

  const roomGroups = Array.from(
    courses.reduce((map, course) => {
      const key = course.room || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(course);
      return map;
    }, new Map<string, Course[]>())
  );
  const filteredFacultyGroups = facultyGroups.filter(([faculty, group]) =>
    `${faculty} ${group.map((course) => course.name).join(" ")}`
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase())
  );
  const filteredRoomGroups = roomGroups.filter(([room, group]) =>
    `${room} ${group.map((course) => course.name).join(" ")}`
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase())
  );
  const matchingTimetable = timetable.filter((entry) =>
    `${entry.course} ${entry.faculty ?? ""} ${entry.room ?? ""}`
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase())
  );

  const displayedDate = selectedDate ?? currentTime;
  const selectedDayIndex = displayedDate
    ? displayedDate.getDay() === 0 || displayedDate.getDay() === 6
      ? -1
      : displayedDate.getDay() - 1
    : -1;
  const isShowingToday =
    displayedDate !== null &&
    currentTime !== null &&
    displayedDate.toDateString() === currentTime.toDateString();
  const dateEntries = matchingTimetable
    .filter(
      (entry) =>
        selectedDayIndex >= 0 &&
        getDayIndex(entry.day_name ?? entry.day) === selectedDayIndex
    )
    .sort((left, right) => Number(left.slot) - Number(right.slot));
  const currentSlotIndex = currentTime
    ? PERIODS.findIndex((period) => {
        const [hour, minute] = period.split(":").map(Number);
        return currentTime.getHours() * 60 + currentTime.getMinutes() <=
          hour * 60 + minute;
      })
    : -1;
  const filteredDateEntries = dateEntries;
  const nextEntry =
    dateEntries.find(
      (entry) =>
        !isShowingToday ||
        (currentSlotIndex >= 0 && Number(entry.slot) >= currentSlotIndex)
    ) ??
    matchingTimetable.find(
      (entry) => getDayIndex(entry.day_name ?? entry.day) > selectedDayIndex
    ) ??
    matchingTimetable[0];
  const courseFieldErrors = getCourseFieldErrors(courses);
  const completeCourses = courses.filter(
    (course) => Object.keys(courseFieldErrors[course.id] ?? {}).length === 0
  ).length;
  const coursesReady = courses.length > 0 && completeCourses === courses.length;
  const setupProgress = courses.length
    ? Math.round((completeCourses / courses.length) * 100)
    : 0;
  const blockedSlots = new Set<string>();
  preferences.unavailable_days.forEach((day) => {
    PERIODS.forEach((_, slot) => blockedSlots.add(`${day}-${slot}`));
  });
  preferences.unavailable_ranges.forEach((range) => {
    for (let slot = range.start_slot; slot <= range.end_slot; slot += 1) {
      blockedSlots.add(`${range.day}-${slot}`);
    }
  });
  const openPeriods = DAYS.length * PERIODS.length - blockedSlots.size;
  const generationReadinessIssues = [
    totalHours > DAYS.length * PERIODS.length
      ? `Courses request ${totalHours} weekly periods, but the timetable has only ${DAYS.length * PERIODS.length} slots.`
      : "",
    ...courses
      .filter(
        (course) =>
          Number.isInteger(course.hours_per_week) &&
          course.hours_per_week > openPeriods
      )
      .map(
        (course) =>
          `${course.name || "A course"} needs ${course.hours_per_week} periods, but only ${openPeriods} remain after required unavailable times.`
      ),
  ].filter(Boolean);
  const generationReady =
    coursesReady && generationReadinessIssues.length === 0;
  const preferencesCustomized =
    preferences.unavailable_days.length > 0 ||
    preferences.unavailable_ranges.length > 0 ||
    preferences.preferred_periods.length > 0 ||
    preferences.preferred_earliest_start !==
      DEFAULT_PREFERENCES.preferred_earliest_start ||
    preferences.preferred_latest_finish !==
      DEFAULT_PREFERENCES.preferred_latest_finish ||
    preferences.preferred_break_slot !==
      DEFAULT_PREFERENCES.preferred_break_slot ||
    preferences.compact_days !== DEFAULT_PREFERENCES.compact_days ||
    preferences.minimize_gaps !== DEFAULT_PREFERENCES.minimize_gaps;
  const currentMinuteOfDay = currentTime
    ? currentTime.getHours() * 60 + currentTime.getMinutes()
    : -1;
  const agendaPosition =
    isShowingToday && currentMinuteOfDay >= 9 * 60 && currentMinuteOfDay <= 16 * 60
      ? ((currentMinuteOfDay - 9 * 60) / (7 * 60)) * 100
      : null;
  const assistantContext: AssistantContext = {
    courses: courses.map(({ name, hours_per_week, faculty, room }) => ({
      name,
      hours_per_week,
      faculty,
      room,
    })),
    timetable,
    preferences,
    generationConflict: generationConflict
      ? {
          message: error,
          courses: generationConflict.courses,
          constraints: generationConflict.constraints,
          suggestions: generationConflict.suggestions,
        }
      : null,
    fitSummary,
  };

  function shiftSelectedDate(offset: number) {
    setSelectedDate((current) => {
      const nextDate = new Date(current ?? new Date());
      nextDate.setDate(nextDate.getDate() + offset);
      return nextDate;
    });
  }

  function openPage(page: string, trigger?: HTMLElement) {
    if (page !== activePage) {
      shouldAnimatePageOpen.current = true;
      const contentBounds = pageContentRef.current?.getBoundingClientRect();
      const triggerBounds = trigger?.getBoundingClientRect();
      pageTransitionOrigin.current =
        contentBounds && triggerBounds
          ? {
              x: triggerBounds.left + triggerBounds.width / 2 - contentBounds.left,
              y: triggerBounds.top + triggerBounds.height / 2 - contentBounds.top,
            }
          : null;
    }
    setActivePage(page);
    setError("");
    setNotice("");
    setNotificationsOpen(false);
    setProfileOpen(false);
  }

  function renderTimetable(
    compact = false,
    schedule: TimetableEntry[] = timetable
  ) {
    const scheduleEntries = schedule.filter((entry) =>
      `${entry.course} ${entry.faculty ?? ""} ${entry.room ?? ""}`
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase())
    );
    const minWidth = compact ? "900px" : "1120px";

    return (
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `76px repeat(5, minmax(0, 1fr))`,
            }}
          >
            <div className="border-b border-r border-[#eeeeee] bg-[#fafafa] p-3" />

            {DAYS.map((day) => (
              <div
                key={day}
                className="border-b border-r border-[#eeeeee] bg-[#fafafa] px-3 py-4 text-center last:border-r-0 sm:px-4"
              >
                <p className="text-sm font-semibold text-[#333333] sm:text-base">
                  {compact ? day.slice(0, 3) : day}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#aaaaaa]">
                  {day === "Monday"
                    ? "MON"
                    : day === "Tuesday"
                      ? "TUE"
                      : day === "Wednesday"
                        ? "WED"
                        : day === "Thursday"
                          ? "THU"
                          : "FRI"}
                </p>
              </div>
            ))}

            {PERIODS.map((period, slotIndex) => (
              <div key={period} className="contents">
                <div className="flex min-h-[120px] flex-col items-center justify-start border-b border-r border-[#eeeeee] bg-[#fafafa] px-2 py-5 sm:min-h-[150px]">
                  <span className="text-sm font-semibold text-[#454545]">
                    {period}
                  </span>
                  <span className="mt-2 text-[10px] text-[#aaaaaa]">
                    P{slotIndex + 1}
                  </span>
                </div>

                {DAYS.map((day, dayIndex) => {
                  const entry = scheduleEntries.find(
                    (item) =>
                      getDayIndex(item.day_name ?? item.day) === dayIndex &&
                      Number(item.slot) === slotIndex
                  );

                  const matchingCourse = entry
                    ? courses.find(
                        (course) =>
                          course.name.toLowerCase() ===
                          entry.course.toLowerCase()
                      )
                    : undefined;

                  const accent = entry
                    ? matchingCourse?.color ?? courseColor(entry.course)
                    : "#e7e3fb";

                  return (
                    <div
                      key={`${day}-${slotIndex}`}
                      className="min-h-[120px] border-b border-r border-[#eeeeee] p-2 last:border-r-0 sm:min-h-[150px] sm:p-3"
                    >
                      {entry ? (
                        <div
                          className="timetable-class-card flex h-full min-h-[100px] flex-col justify-between rounded-xl border p-3 sm:min-h-[126px] sm:p-4"
                          style={{
                            backgroundColor: `${accent}14`,
                            borderColor: `${accent}45`,
                          }}
                        >
                          <div>
                            <div
                              className="mb-3 h-1 w-8 rounded-full"
                              style={{ backgroundColor: accent }}
                            />
                            <p className="break-words text-sm font-semibold leading-5 text-[#303030] sm:text-base">
                              {entry.course}
                            </p>
                          </div>

                          <div className="mt-4 space-y-1.5">
                            {(entry.faculty || matchingCourse?.faculty) && (
                              <p className="truncate text-xs text-[#777777] sm:text-sm">
                                {entry.faculty || matchingCourse?.faculty}
                              </p>
                            )}
                            {(entry.room || matchingCourse?.room) && (
                              <p className="truncate text-[11px] text-[#999999] sm:text-xs">
                                {entry.room || matchingCourse?.room}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[100px] items-center justify-center rounded-xl border border-dashed border-[#eeeeee] sm:min-h-[126px]">
                          <span className="text-xs text-[#d0d0d0]">—</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentNavigation =
    NAVIGATION.find((item) => item.name === activePage) ?? NAVIGATION[0];
  const pageContent = PAGE_CONTENT[activePage] ?? PAGE_CONTENT.Overview;

  return (
    <div
      ref={root}
      className="app-frame chronos-liquid-theme min-h-screen overflow-x-clip bg-[#f5f1e9] text-[#262521] selection:bg-[#ffe1bd]"
    >

      <style jsx global>{`
        .chronos-liquid-theme {
          position: relative;
          isolation: isolate;
          background-color: #f5f1e9;
          background-image:
            radial-gradient(ellipse at 8% 3%, rgba(255, 179, 105, 0.14), transparent 34%),
            radial-gradient(ellipse at 92% 14%, rgba(155, 145, 255, 0.12), transparent 30%),
            radial-gradient(ellipse at 54% 90%, rgba(112, 201, 191, 0.09), transparent 36%);
          background-repeat: no-repeat;
        }

        .chronos-shell {
          width: 100%;
          min-width: 0;
          align-items: flex-start;
        }

        .liquid-glass-panel {
          background-color: rgba(255, 253, 248, 0.76) !important;
          border-color: rgba(220, 211, 196, 0.78) !important;
          -webkit-backdrop-filter: blur(18px) saturate(1.16);
          backdrop-filter: blur(18px) saturate(1.16);
          box-shadow:
            0 10px 30px rgba(53, 45, 32, 0.045),
            inset 0 1px 0 rgba(255, 255, 255, 0.88);
          transition:
            background-color 220ms ease,
            border-color 220ms ease,
            box-shadow 220ms ease,
            transform 220ms ease;
        }

        .top-header.liquid-glass-panel {
          background-image: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.48),
            rgba(255, 250, 239, 0.2)
          );
        }

        .liquid-sidebar {
          background:
            radial-gradient(ellipse at 10% 0%, rgba(255, 138, 36, 0.14), transparent 45%),
            linear-gradient(155deg, rgba(45, 44, 41, 0.97), rgba(31, 31, 29, 0.98)) !important;
          border: 1px solid rgba(255, 255, 255, 0.09);
          box-shadow:
            0 22px 60px rgba(31, 29, 25, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.07);
        }

        .dashboard-metric-card,
        .feature-card,
        .agenda-panel,
        .page-content-stage section.scroll-reveal {
          transition:
            transform 260ms cubic-bezier(0.2, 0.75, 0.25, 1),
            box-shadow 260ms ease,
            border-color 260ms ease,
            background-color 260ms ease;
        }

        .dashboard-metric-card,
        .feature-card {
          -webkit-backdrop-filter: blur(12px) saturate(1.08);
          backdrop-filter: blur(12px) saturate(1.08);
        }

        .dashboard-metric-card:hover,
        .feature-card:hover {
          border-color: rgba(255, 138, 36, 0.32);
          box-shadow:
            0 16px 38px rgba(48, 40, 28, 0.075),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .timetable-class-card {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          transform: translateZ(0);
          animation: chronos-card-enter 420ms cubic-bezier(0.2, 0.75, 0.25, 1) both;
          transition:
            transform 220ms ease,
            box-shadow 220ms ease,
            border-color 220ms ease;
        }

        .timetable-class-card::after {
          position: absolute;
          inset: 0;
          z-index: -1;
          content: "";
          pointer-events: none;
          background: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0.34),
            transparent 42%,
            rgba(255, 255, 255, 0.08)
          );
          opacity: 0.62;
        }

        .timetable-class-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(44, 38, 29, 0.075);
        }

        .chronos-dropdown {
          transform-origin: top right;
          animation: chronos-dropdown-enter 190ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
          -webkit-backdrop-filter: blur(18px) saturate(1.14);
          backdrop-filter: blur(18px) saturate(1.14);
        }

        .mobile-navigation.liquid-glass-panel {
          bottom: max(0.75rem, env(safe-area-inset-bottom));
          background-color: rgba(255, 253, 248, 0.88) !important;
          box-shadow:
            0 14px 45px rgba(34, 30, 23, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        .chronos-liquid-theme button {
          -webkit-tap-highlight-color: transparent;
        }

        .chronos-liquid-theme button:active {
          transition-duration: 90ms;
        }

        .chronos-liquid-theme button:active:not(:disabled) {
          transform: scale(0.985);
        }

        .chronos-liquid-theme button:focus-visible,
        .chronos-liquid-theme input:focus-visible,
        .chronos-liquid-theme select:focus-visible,
        .chronos-liquid-theme textarea:focus-visible {
          outline: 2px solid rgba(255, 138, 36, 0.78);
          outline-offset: 3px;
        }

        .page-content-stage,
        .page-content-stage > * {
          min-width: 0;
        }

        .page-content-stage .overflow-x-auto {
          max-width: 100%;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          touch-action: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(157, 146, 126, 0.45) transparent;
        }

        @keyframes chronos-card-enter {
          from {
            opacity: 0;
            transform: translateY(7px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes chronos-dropdown-enter {
          from {
            opacity: 0;
            transform: translateY(-5px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 767px) {
          .chronos-shell {
            gap: 0;
          }

          .top-header.liquid-glass-panel {
            -webkit-backdrop-filter: blur(14px) saturate(1.1);
            backdrop-filter: blur(14px) saturate(1.1);
          }

          .page-content-stage {
            padding-bottom: max(6rem, calc(5.5rem + env(safe-area-inset-bottom)));
          }

          .timetable-class-card:hover {
            transform: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .chronos-liquid-theme *,
          .chronos-liquid-theme *::before,
          .chronos-liquid-theme *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      <div
        className={`dashboard-shell chronos-shell relative isolate flex min-h-screen gap-5 p-3 sm:gap-6 sm:p-5 ${activePage !== "Overview" ? "dashboard-shell--interior" : ""}`}
      >
        {fluidSmokeReady && (
          <div
            data-aifx="fluid-smoke"
            className="absolute inset-0 -z-10 pointer-events-none"
            aria-hidden="true"
          />
        )}
        {/* Desktop sidebar */}
        <aside className="desktop-sidebar liquid-sidebar sticky top-5 hidden h-[calc(100vh-2.5rem)] w-[240px] shrink-0 flex-col overflow-y-auto rounded-[26px] bg-[#252523] px-4 py-5 text-white shadow-[0_20px_60px_rgba(31,29,25,0.14)] lg:flex">
          <div className="mb-9 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff8a24] text-[#252523]">
              <Activity size={22} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Chronos</p>
              <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.18em] text-white/50">
                Focus, in rhythm
              </p>
            </div>
          </div>

          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Workspace
          </p>

          <nav aria-label="Workspace" className="space-y-1">
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.name;

              return (
                <button
                  key={item.name}
                  onClick={(event) => {
                    openPage(item.name, event.currentTarget);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] transition-colors ${
                    active
                      ? "bg-[#ff8a24] text-[#262521]"
                      : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span className="font-medium">{item.label}</span>
                  {active && (
                    <ArrowRight
                      className="ml-auto"
                      size={14}
                      strokeWidth={1.8}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <SidebarRobot
            context={assistantContext}
            onOpenCalendar={() => openPage("Timetable")}
          />

<div className="mt-auto border-t border-white/10 px-2 pt-5">
  <div className="mb-4 flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9e0d0] text-[11px] font-semibold text-[#454139]">
      SW
    </div>
    <div>
      <p className="text-xs font-semibold">Student workspace</p>
      <p className="mt-1 text-[10px] text-white/45">
        Local planner
      </p>
    </div>
  </div>

  <LogoutButton />
</div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <header className="top-header liquid-glass-panel relative z-40 flex min-h-[68px] items-center justify-between gap-4 rounded-2xl border border-[#e8e1d6] bg-[#faf8f3] px-4 shadow-[0_4px_16px_rgba(44,39,31,0.035)] sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#252523] text-[#ff8a24] lg:hidden">
                <Activity size={16} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a39b8e]">
                  Chronos workspace
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#2a2925]">
                  {currentNavigation.label}
                </p>
              </div>
            </div>

            <label className={`relative max-w-[340px] flex-1 ${activePage === "Courses" ? "hidden" : "hidden md:block"}`}>
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999184]"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search courses, faculty, rooms..."
                aria-label="Search courses, faculty, and rooms"
                className="h-10 w-full rounded-xl border border-[#e8e1d6] bg-white pl-10 pr-4 text-xs text-[#2a2925] outline-none transition placeholder:text-[#a9a196] focus:border-[#ff8a24]"
              />
            </label>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-[#e8e1d6] bg-white px-3 py-2 sm:flex">
                <span
                  className={`h-2 w-2 rounded-full ${
                    generated ? "bg-[#4e9b78]" : "bg-[#ff8a24]"
                  }`}
                />
                <span className="text-[10px] font-medium text-[#716b61]">
                  {generated ? "Schedule ready" : "Planner active"}
                </span>
              </div>

              <button
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e1d6] bg-white text-[#514c43] transition hover:border-[#ff8a24] hover:text-[#bc5810]"
              >
                <Bell size={17} />
                {generated && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#ff8a24]" />
                )}
              </button>

              <button
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setNotificationsOpen(false);
                }}
                aria-label="Student workspace menu"
                aria-expanded={profileOpen}
                className="flex h-10 items-center gap-2 rounded-xl border border-[#e8e1d6] bg-white px-2 text-left transition hover:border-[#ff8a24] sm:px-2.5"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#252523] text-[9px] font-semibold text-white">
                  SW
                </span>
                <span className="hidden text-[11px] font-semibold text-[#514c43] sm:inline">
                  Workspace
                </span>
                <ChevronDown size={13} className="hidden text-[#8e877c] sm:block" />
              </button>
            </div>

            {notificationsOpen && (
              <div className="chronos-dropdown absolute right-14 top-[calc(100%+10px)] z-50 w-[min(320px,calc(100vw-32px))] rounded-2xl border border-[#e8e1d6] bg-white p-4 shadow-[0_18px_55px_rgba(34,30,23,0.16)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#292823]">
                    Updates
                  </h2>
                  <button
                    onClick={() => setNotificationsOpen(false)}
                    aria-label="Close updates"
                    className="rounded-lg p-1.5 text-[#8c857a] hover:bg-[#f6f2eb]"
                  >
                    <X size={15} />
                  </button>
                </div>
                {generated ? (
                  <button
                    onClick={() => openPage("Timetable")}
                    className="mt-3 flex w-full items-start gap-3 rounded-xl bg-[#fff5eb] p-3 text-left transition hover:bg-[#ffeedc]"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ff8a24] text-[#292823]">
                      <Check size={16} />
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-[#292823]">
                        Your schedule is ready
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-[#756d62]">
                        {lastGeneratedAt
                          ? `Updated ${lastGeneratedAt.toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}. View your weekly calendar.`
                          : "View your weekly calendar."}
                      </span>
                    </span>
                  </button>
                ) : (
                  <p className="mt-3 rounded-xl bg-[#f8f5ef] p-3 text-xs leading-5 text-[#756d62]">
                    You&apos;re all caught up. Schedule updates will appear here
                    after you generate a timetable.
                  </p>
                )}
                {pendingSchedule && (
                  <p className="mt-3 rounded-xl bg-[#fff5eb] p-3 text-xs leading-5 text-[#635d53]">
                    A schedule preview is waiting for your review on Calendar.
                  </p>
                )}
                <div className="mt-3 rounded-xl border border-[#e8e1d6] p-3">
                  <p className="text-xs font-semibold">Reminders</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#635d53]">
                    Automatic class reminders are not supported while Chronos is
                    closed. Export the timetable to a calendar app for reminders.
                  </p>
                </div>
              </div>
            )}

            {profileOpen && (
              <div className="chronos-dropdown absolute right-0 top-[calc(100%+10px)] z-50 w-56 rounded-2xl border border-[#e8e1d6] bg-white p-2 shadow-[0_18px_55px_rgba(34,30,23,0.16)]">
                <div className="border-b border-[#eee8de] px-3 py-2.5">
                  <p className="text-xs font-semibold text-[#292823]">
                    Student workspace
                  </p>
                  <p className="mt-1 text-[10px] text-[#8b8479]">
                    Local timetable planner
                  </p>
                </div>
                <button
                  onClick={() => openPage("Courses")}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-[#514c43] hover:bg-[#f8f5ef]"
                >
                  <BookOpen size={14} /> Manage courses
                </button>
                <button
                  onClick={() => openPage("Constraints")}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-[#514c43] hover:bg-[#f8f5ef]"
                >
                  <Settings2 size={14} /> Scheduler preferences
                </button>
              </div>
            )}
          </header>

          {/* Mobile navigation */}
          <nav
            aria-label="Primary"
            className="mobile-navigation liquid-glass-panel fixed inset-x-3 bottom-3 z-40 grid grid-cols-6 rounded-2xl border border-[#e6ded1] bg-[#fffdf8]/95 p-1.5 shadow-[0_14px_45px_rgba(34,30,23,0.18)] backdrop-blur lg:hidden"
          >
              {NAVIGATION.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.name;

                return (
                  <button
                    key={item.name}
                    onClick={(event) => {
                      openPage(item.name, event.currentTarget);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-medium transition-colors ${
                      active
                        ? "bg-[#252523] text-white shadow-sm"
                        : "text-[#756e62] hover:bg-[#f5f0e8] hover:text-[#292823]"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </nav>

          <div
            ref={pageContentRef}
            className="page-content-stage mx-auto w-full max-w-[1440px] px-4 pb-24 pt-7 sm:px-6 sm:pb-28 sm:pt-9 lg:px-6 lg:pb-10 lg:pt-9"
          >
            <DashboardPageHeader
              eyebrow={
                activePage === "Overview"
                  ? "YOUR CAMPUS, IN SYNC"
                  : pageContent.eyebrow
              }
              title={
                activePage === "Overview"
                  ? `${currentTime ? (currentTime.getHours() < 12 ? "Good morning" : currentTime.getHours() < 18 ? "Good afternoon" : "Good evening") : "Welcome"}`
                  : pageContent.title
              }
              description={
                activePage === "Overview"
                  ? "Your classes, rooms, and open time—together in one clear plan."
                  : pageContent.description
              }
              visualSrc={
                activePage === "Overview"
                  ? undefined
                  : activePage === "Timetable"
                    ? "/images/library-study.jpg"
                    : activePage === "Courses"
                      ? "/images/lecture-hall.jpg"
                      : activePage === "Faculty"
                        ? "/images/campus-study.jpg"
                        : activePage === "Rooms"
                          ? "/images/lecture-hall.jpg"
                          : "/images/library-study.jpg"
              }
              controls={
                activePage === "Courses" ? (
                  <label className="relative block w-full max-w-lg">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999184]"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search courses, faculty, or rooms..."
                      aria-label="Search courses, faculty, and rooms"
                      className="h-11 w-full rounded-xl border border-[#e8e1d6] bg-white/80 pl-10 pr-4 text-xs text-[#2a2925] outline-none transition placeholder:text-[#8e877c] focus:border-[#ff8a24]"
                    />
                  </label>
                ) : (
                  <label className="relative block md:hidden">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999184]"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search courses, faculty, rooms..."
                      aria-label="Search courses, faculty, and rooms"
                      className="h-11 w-full rounded-xl border border-[#e8e1d6] bg-white/80 pl-10 pr-4 text-xs text-[#2a2925] outline-none transition placeholder:text-[#8e877c] focus:border-[#ff8a24]"
                    />
                  </label>
                )
              }
              metadata={
                activePage === "Courses" ? (
                  <span className="rounded-xl border border-[#e8e1d6] bg-white/75 px-3.5 py-2 text-xs font-medium text-[#625b50]">
                    {filteredCourses.length} shown
                  </span>
                ) : activePage === "Faculty" ? (
                  <span className="rounded-xl border border-[#e8e1d6] bg-white/75 px-3.5 py-2 text-xs font-medium text-[#625b50]">
                    {filteredFacultyGroups.length} of {facultyGroups.length} members
                  </span>
                ) : activePage === "Rooms" ? (
                  <span className="rounded-xl border border-[#e8e1d6] bg-white/75 px-3.5 py-2 text-xs font-medium text-[#625b50]">
                    {filteredRoomGroups.length} of {roomGroups.length} rooms
                  </span>
                ) : null
              }
              actions={
                activePage === "Overview" ||
                activePage === "Timetable" ||
                activePage === "Constraints" ||
                activePage === "Courses" ? (
                <button
                  onClick={
                    activePage === "Courses"
                      ? addCourse
                      : activePage === "Overview" &&
                          timetable.length === 0 &&
                          !coursesReady
                        ? () => openPage("Courses")
                        : () => generateTimetable()
                  }
                  disabled={activePage !== "Courses" && loading}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ff8a24] px-4 text-[12px] font-semibold text-[#252523] shadow-[0_5px_15px_rgba(224,109,28,0.2)] transition hover:-translate-y-0.5 hover:bg-[#ffa14d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activePage === "Courses" ? (
                    <Plus size={15} />
                  ) : loading ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : activePage === "Overview" &&
                    timetable.length === 0 &&
                    !coursesReady ? (
                    <BookOpen size={15} />
                  ) : (
                    <WandSparkles size={15} />
                  )}
                  {activePage === "Courses"
                    ? "Add course"
                    : loading
                      ? "Generating..."
                      : activePage === "Overview"
                        ? timetable.length > 0
                          ? "Add schedule"
                          : coursesReady
                            ? "Generate timetable"
                            : "Configure courses"
                        : "Generate timetable"}
                </button>
                ) : null
              }
            />

            {/* Status messages */}
            {error && (
              <div role="alert" className="reveal mb-6 flex items-start gap-3 rounded-2xl border border-[#f0d6d0] bg-[#fff6f3] p-5 text-sm text-[#a04f40]">
                <Activity size={19} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1 leading-6">{error}</div>
                <button
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                  className="rounded-lg p-1 hover:bg-[#fce9e4]"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            {notice && (
              <div role="status" className="reveal mb-6 flex items-start gap-3 rounded-2xl border border-[#d8ebe2] bg-[#f3faf6] p-5 text-sm text-[#36775c]">
                <Check size={19} className="mt-0.5 shrink-0" />
                <p className="flex-1 leading-6">{notice}</p>
                <button
                  onClick={() => setNotice("")}
                  aria-label="Dismiss message"
                  className="rounded-lg p-1 hover:bg-[#e7f5ed]"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            {/* Overview */}
            {activePage === "Overview" && (
              <div className="overview-stack">
                <div className="dashboard-metric-grid grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "Courses configured",
                      value: courses.length,
                      detail: "Courses in this workspace",
                      icon: BookOpen,
                      tone: "courses",
                      color: "#7953a6",
                      bg: "#f3eef9",
                      cardBg: "#f3e7bf",
                      borderColor: "#c89c19",
                    },
                    {
                      label: "Faculty members",
                      value: uniqueFaculty,
                      detail: "Unique faculty assignments",
                      icon: GraduationCap,
                      tone: "faculty",
                      color: "#459b87",
                      bg: "#e7f6f0",
                      cardBg: "#dcebe5",
                      borderColor: "#567a70",
                    },
                    {
                      label: "Rooms",
                      value: uniqueRooms,
                      detail: "Rooms assigned to courses",
                      icon: DoorOpen,
                      tone: "rooms",
                      color: "#648ed0",
                      bg: "#eaf1ff",
                      cardBg: "#d9e9e7",
                      borderColor: "#528b82",
                    },
                    {
                      label: "Scheduled periods",
                      value: generated ? timetable.length : 0,
                      detail: generated
                        ? "Periods in the generated timetable"
                        : `${totalHours} requested across ${courses.length} courses · none placed yet`,
                      icon: Clock3,
                      tone: "periods",
                      color: "#7960a4",
                      bg: "#f3eef9",
                      cardBg: "#f1ead5",
                      borderColor: "#b89a47",
                    },
                  ].map((stat) => {
                    const Icon = stat.icon;

                    return (
                      <div
                        key={stat.label}
                        className={`dashboard-metric-card dashboard-metric-card--${stat.tone} scroll-reveal rounded-2xl border border-[#d8e5e2] border-t-[3px] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(30,30,30,0.045)] sm:p-6`}
                        style={{
                          backgroundColor: stat.cardBg,
                          borderTopColor: stat.borderColor,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            data-scroll-reveal-item
                            className="metric-label text-sm font-medium text-[#71807c]"
                          >
                            {stat.label}
                          </span>
                          <div
                            data-scroll-reveal-icon
                            className="metric-icon flex h-10 w-10 items-center justify-center rounded-xl"
                            style={{
                              color: stat.color,
                              backgroundColor: stat.bg,
                            }}
                          >
                            <Icon size={20} strokeWidth={1.8} />
                          </div>
                        </div>
                        <p
                          data-scroll-reveal-item
                          className="metric-value mt-5 text-[32px] font-semibold tracking-[-0.045em] text-[#253633] sm:text-[36px]"
                        >
                          {stat.value}
                        </p>
                        <p
                          data-scroll-reveal-item
                          className="metric-detail mt-2 text-xs leading-5 text-[#71807c] sm:text-sm"
                        >
                          {stat.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <section className="agenda-panel scroll-reveal overflow-hidden rounded-[26px] bg-[#252523] text-white shadow-[0_20px_52px_rgba(37,37,35,0.16)]">
                  <div className="flex flex-col justify-between gap-5 px-5 py-5 sm:flex-row sm:items-center sm:px-7 sm:py-6">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span
                          data-scroll-reveal-icon
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff8a24] text-[#252523]"
                        >
                          <CalendarDays size={16} />
                        </span>
                        <div>
                          <p
                            data-scroll-reveal-item
                            className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45"
                          >
                            Your day, at a glance
                          </p>
                          <h2
                            data-scroll-reveal-item
                            className="mt-1 text-lg font-semibold tracking-tight sm:text-xl"
                          >
                            Daily agenda
                          </h2>
                        </div>
                      </div>
                      <p
                        data-scroll-reveal-item
                        className="mt-3 pl-10 text-xs text-white/55 sm:text-sm"
                      >
                        {displayedDate
                          ? displayedDate.toLocaleDateString(undefined, {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                            })
                          : "Preparing today’s schedule"}
                        <span className="px-2 text-white/25">·</span>
                        {dateEntries.length}{" "}
                        {dateEntries.length === 1 ? "class" : "classes"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => shiftSelectedDate(-1)}
                        aria-label="Previous day"
                        data-scroll-reveal-item
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button
                        onClick={() => setSelectedDate(currentTime ?? new Date())}
                        data-scroll-reveal-item
                        className="h-9 rounded-xl border border-white/15 px-3 text-[11px] font-medium text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                      >
                        Today
                      </button>
                      <button
                        onClick={() => shiftSelectedDate(1)}
                        aria-label="Next day"
                        data-scroll-reveal-item
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                      >
                        <ChevronRight size={17} />
                      </button>
                      <button
                        onClick={() => openPage("Timetable")}
                        data-scroll-reveal-item
                        className="ml-1 flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-[11px] font-semibold text-[#252523] transition hover:bg-[#ffead8] sm:px-4"
                      >
                        Week view <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mx-5 border-t border-white/10 sm:mx-7"
                  />

                  {timetable.length === 0 ? (
                    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
                      <div
                        data-scroll-reveal-icon
                        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-[#ff9a43]"
                      >
                        <Sparkles size={24} />
                      </div>
                      <h3
                        data-scroll-reveal-item
                        className="mt-5 text-lg font-semibold"
                      >
                        Your schedule starts here
                      </h3>
                      <p
                        data-scroll-reveal-item
                        className="mt-2 max-w-sm text-sm leading-6 text-white/55"
                      >
                        {coursesReady
                          ? "Before generating, review Courses and confirm each course’s weekly periods, faculty, and room. Set availability or timing preferences in Preferences."
                          : "Start in Courses: add each course’s weekly periods, faculty, and room. Then set availability or timing preferences before generating."}
                      </p>
                      <button
                        onClick={() =>
                          coursesReady
                            ? generateTimetable()
                            : openPage("Courses")
                        }
                        disabled={loading}
                        data-scroll-reveal-item
                        className="mt-5 flex min-h-11 items-center gap-2 rounded-xl bg-[#ff8a24] px-4 py-2 text-sm font-semibold text-[#252523] transition hover:bg-[#ffa14d] focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading ? (
                          <LoaderCircle size={16} className="animate-spin" />
                        ) : coursesReady ? (
                          <WandSparkles size={16} />
                        ) : (
                          <BookOpen size={16} />
                        )}
                        {loading
                          ? "Building schedule…"
                          : coursesReady
                            ? "Generate timetable"
                            : "Configure courses"}
                      </button>
                    </div>
                  ) : selectedDayIndex < 0 ? (
                    <div className="flex min-h-[290px] flex-col items-center justify-center px-6 py-12 text-center">
                      <CalendarDays
                        data-scroll-reveal-icon
                        size={25}
                        className="text-[#ff9a43]"
                      />
                      <h3
                        data-scroll-reveal-item
                        className="mt-4 text-base font-semibold"
                      >
                        A little room to breathe
                      </h3>
                      <p
                        data-scroll-reveal-item
                        className="mt-2 max-w-sm text-sm leading-6 text-white/55"
                      >
                        Classes run Monday through Friday. Use the arrows to
                        explore each day of your schedule.
                      </p>
                    </div>
                  ) : filteredDateEntries.length === 0 ? (
                    <div className="flex min-h-[290px] flex-col items-center justify-center px-6 py-12 text-center">
                      <CalendarDays
                        data-scroll-reveal-icon
                        size={25}
                        className="text-[#ff9a43]"
                      />
                      <h3
                        data-scroll-reveal-item
                        className="mt-4 text-base font-semibold"
                      >
                        {searchQuery.trim()
                          ? "No matching classes"
                          : "No classes planned"}
                      </h3>
                      <p
                        data-scroll-reveal-item
                        className="mt-2 max-w-sm text-sm leading-6 text-white/55"
                      >
                        {searchQuery.trim()
                          ? "Try another course, faculty member, or room."
                          : "This day is open in your generated timetable."}
                      </p>
                    </div>
                  ) : (
                    <div className="px-4 pb-5 pt-3 sm:px-7 sm:pb-7">
                      <div className="mb-3 flex items-center justify-between pl-[68px] text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35 sm:pl-[76px]">
                        <span data-scroll-reveal-item>Scheduled blocks</span>
                        <span data-scroll-reveal-item>09:00 — 16:00</span>
                      </div>
                      <div
                        className="agenda-rows relative"
                        role="list"
                        aria-label="Classes for the selected day"
                      >
                        {agendaPosition !== null && (
                          <div
                            className="agenda-current-time"
                            style={{ top: `${agendaPosition}%` }}
                            aria-label={`Current time ${currentTime?.toLocaleTimeString(
                              [],
                              { hour: "numeric", minute: "2-digit" }
                            )}`}
                          >
                            <span className="agenda-time-pill">
                              {currentTime?.toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                        {PERIODS.map((period, index) => {
                          const entry = filteredDateEntries.find(
                            (item) => Number(item.slot) === index
                          );
                          const matchingCourse = entry
                            ? courses.find(
                                (course) =>
                                  course.name.toLowerCase() ===
                                  entry.course.toLowerCase()
                              )
                            : undefined;
                          const accent = entry
                            ? matchingCourse?.color ?? "#ff8a24"
                            : undefined;

                          return (
                            <div
                              key={period}
                              role="listitem"
                              className="agenda-row grid grid-cols-[55px_minmax(0,1fr)] items-stretch gap-3 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-4"
                            >
                              <div className="flex flex-col items-start pt-3.5">
                                <span data-scroll-reveal-item className="text-[11px] font-semibold text-white/75">
                                  {period}
                                </span>
                                <span data-scroll-reveal-item className="mt-1 text-[9px] text-white/35">
                                  P{index + 1}
                                </span>
                              </div>
                              <div className="agenda-slot flex min-h-[68px] items-center border-t border-white/[0.09] py-2">
                                {entry && accent ? (
                                  <div
                                    data-scroll-reveal-item
                                    className="agenda-event flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 sm:px-4"
                                    style={{
                                      backgroundColor: `${accent}25`,
                                      borderColor: `${accent}75`,
                                    }}
                                  >
                                    <span
                                      className="h-9 w-1 shrink-0 rounded-full"
                                      style={{ backgroundColor: accent }}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p
                                        data-scroll-reveal-item
                                        className="truncate text-xs font-semibold text-white sm:text-sm"
                                      >
                                        {entry.course}
                                      </p>
                                      <p
                                        data-scroll-reveal-item
                                        className="mt-1 truncate text-[10px] text-white/60 sm:text-xs"
                                      >
                                        {entry.faculty || matchingCourse?.faculty}
                                        {entry.room || matchingCourse?.room
                                          ? ` · ${entry.room || matchingCourse?.room}`
                                          : ""}
                                      </p>
                                    </div>
                                    <span
                                      data-scroll-reveal-item
                                      className="hidden rounded-lg bg-black/15 px-2 py-1 text-[9px] font-medium text-white/70 sm:block"
                                    >
                                      {index < 3 ? "Morning" : "Afternoon"}
                                    </span>
                                  </div>
                                ) : (
                                  <span data-scroll-reveal-item className="px-2 text-[10px] text-white/20">
                                    Open time
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p
                        data-scroll-reveal-item
                        className="mt-3 flex items-center gap-2 pl-[68px] text-[10px] text-white/40 sm:pl-[76px]"
                      >
                        <span
                          data-scroll-reveal-icon
                          className="h-1.5 w-1.5 rounded-full bg-[#ff8a24]"
                        />
                        {agendaPosition !== null
                          ? "Current time"
                          : isShowingToday
                            ? "Your live day marker appears during class hours."
                            : "Showing your selected day."}
                      </p>
                    </div>
                  )}
                </section>

                <div className="dashboard-feature-grid grid grid-cols-1 gap-5 md:grid-cols-2">
                  <section className="feature-card dashboard-feature-card dashboard-feature-card--next dashboard-photo-card min-h-[174px] rounded-[22px] border border-[#e9e1d5] bg-[#fffdf8] p-3 shadow-[0_8px_24px_rgba(45,38,28,0.045)] sm:p-3.5">
                    <div className="dashboard-photo-copy flex min-w-0 items-center gap-3 px-2 py-2 sm:gap-4 sm:px-3">
                      <div data-scroll-reveal-icon className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dff5f0] text-[#168b7c]">
                        <Clock3 size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p data-scroll-reveal-item className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#71878a]">
                          Up next
                        </p>
                        {nextEntry ? (
                          <>
                            <h2 data-scroll-reveal-item className="mt-2 truncate text-base font-semibold text-[#203b45]">
                              {nextEntry.course}
                            </h2>
                            <p data-scroll-reveal-item className="mt-1 truncate text-xs text-[#65797d]">
                              {DAYS[getDayIndex(nextEntry.day_name ?? nextEntry.day)]}
                              {" · "}
                              {PERIODS[Number(nextEntry.slot)]}
                              {nextEntry.room ? ` · ${nextEntry.room}` : ""}
                            </p>
                          </>
                        ) : (
                          <>
                            <h2 data-scroll-reveal-item className="mt-2 text-base font-semibold text-[#203b45]">
                              No upcoming classes
                            </h2>
                            <p data-scroll-reveal-item className="mt-1 text-xs text-[#65797d]">
                              Generate a timetable to plan your week.
                            </p>
                          </>
                        )}
                        <button
                          onClick={() => openPage("Timetable")}
                          aria-label="Open full calendar"
                          data-scroll-reveal-icon
                          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#cfe8e2] bg-white/80 px-2.5 text-[11px] font-semibold text-[#197c72] transition hover:border-[#64b9a8] hover:bg-[#effaf7]"
                        >
                          View timetable <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="dashboard-photo-wash dashboard-photo-wash--lecture" aria-hidden="true">
                      <Image src="/images/lecture-hall.jpg" alt="" fill sizes="(max-width: 640px) 34vw, 18vw" />
                      <span className="dashboard-glass-tag"><span className="dashboard-glass-dot" />On campus</span>
                    </div>
                  </section>

                  <section className="feature-card dashboard-feature-card dashboard-feature-card--setup dashboard-photo-card min-h-[174px] rounded-[22px] border border-[#e9e1d5] bg-[#fffdf8] p-3 shadow-[0_8px_24px_rgba(45,38,28,0.045)] sm:p-3.5">
                    <div className="dashboard-photo-copy flex min-w-0 items-center gap-3 px-2 py-2 sm:gap-4 sm:px-3">
                      <div data-scroll-reveal-icon className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e9e8ff] text-[#655bc4]">
                        <Check size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p data-scroll-reveal-item className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#71878a]">
                              Course setup
                            </p>
                            <p data-scroll-reveal-item className="mt-2 text-base font-semibold text-[#203b45]">
                              {completeCourses} of {courses.length} ready
                            </p>
                          </div>
                          <span data-scroll-reveal-item className="text-sm font-semibold text-[#675fc0]">
                            {setupProgress}%
                          </span>
                        </div>
                        <div
                          data-scroll-reveal-item
                          className="mt-3 h-2 overflow-hidden rounded-full bg-[#eee8de]"
                          role="progressbar"
                          aria-label="Course setup progress"
                          aria-valuenow={setupProgress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            data-scroll-reveal-indicator
                            className="h-full rounded-full bg-gradient-to-r from-[#786ee0] to-[#45b9a3] transition-[width] duration-500"
                            style={{ width: `${setupProgress}%` }}
                          />
                        </div>
                        <button
                          onClick={() => openPage("Courses")}
                          data-scroll-reveal-item
                          className="mt-2 text-[11px] font-medium text-[#197c72] underline decoration-[#9dcfc3] underline-offset-2 hover:text-[#125e57]"
                        >
                          Review course details
                        </button>
                      </div>
                    </div>
                    <div className="dashboard-photo-wash dashboard-photo-wash--library" aria-hidden="true">
                      <Image src="/images/library-study.jpg" alt="" fill sizes="(max-width: 640px) 34vw, 18vw" />
                      <span className="dashboard-glass-tag"><span className="dashboard-glass-dot" />Study ready</span>
                    </div>
                  </section>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <section className="dashboard-feature-card scroll-reveal rounded-2xl border border-[#eae9e4] bg-white p-6 sm:p-8">
                    <SectionHeading
                      title="Course catalogue"
                      description="A quick look at the subjects in your plan."
                      action={
                        <button
                          onClick={() => setActivePage("Courses")}
                          data-scroll-reveal-item
                          className="flex items-center gap-1.5 text-sm font-medium text-[#bf5a12] hover:text-[#8c3e08]"
                        >
                          Manage <ArrowRight size={15} />
                        </button>
                      }
                    />

                    <div className="space-y-2">
                      {filteredCourses.slice(0, 5).map((course) => (
                        <div
                          key={course.id}
                          className="flex items-center gap-4 rounded-xl px-3 py-3.5 transition hover:bg-[#fafaf8] sm:px-4"
                        >
                          <div
                            data-scroll-reveal-icon
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-semibold"
                            style={{
                              color: course.color,
                              backgroundColor: `${course.color}19`,
                            }}
                          >
                            {initials(course.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p data-scroll-reveal-item className="truncate text-sm font-semibold text-[#353535] sm:text-[15px]">
                              {course.name}
                            </p>
                            <p data-scroll-reveal-item className="mt-1.5 truncate text-xs text-[#999999] sm:text-sm">
                              {course.faculty} · {course.room}
                            </p>
                          </div>
                          <span data-scroll-reveal-item className="shrink-0 rounded-lg bg-[#f5f4f1] px-3 py-2 text-xs font-medium text-[#777777]">
                            {course.hours_per_week} periods
                          </span>
                        </div>
                      ))}
                      {filteredCourses.length === 0 && (
                        <div className="rounded-xl bg-[#f8f5ef] px-4 py-7 text-center">
                          <p
                            data-scroll-reveal-item
                            className="text-sm text-[#777064]"
                          >
                            No courses match your search.
                          </p>
                          <button
                            onClick={() => setSearchQuery("")}
                            data-scroll-reveal-item
                            className="mt-2 text-xs font-semibold text-[#bf5a12] hover:underline"
                          >
                            Clear search
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="dashboard-feature-card scroll-reveal rounded-2xl border border-[#eae9e4] bg-white p-6 sm:p-8">
                    <SectionHeading
                      title="Workspace status"
                      description="Your current scheduling setup."
                    />

                    <div className="space-y-5">
                      {[
                        {
                          label: "Courses configured",
                          value: courses.length > 0,
                          detail:
                            courses.length > 0
                              ? `${courses.length} courses added`
                              : "Add your first course",
                        },
                        {
                          label: "Faculty assignments",
                          value: courses.every((course) =>
                            course.faculty.trim()
                          ),
                          detail: "Faculty assigned to courses",
                        },
                        {
                          label: "Classroom assignments",
                          value: courses.every((course) =>
                            course.room.trim()
                          ),
                          detail: "Rooms assigned to courses",
                        },
                        {
                          label: "Timetable generated",
                          value: generated && timetable.length > 0,
                          detail:
                            generated && timetable.length > 0
                              ? "Schedule is available"
                              : "Generate your weekly schedule",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-3.5"
                        >
                          <div
                            data-scroll-reveal-icon
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              item.value
                                ? "bg-[#fff0df] text-[#bf5a12]"
                                : "bg-[#f4f2ed] text-[#a39c8d]"
                            }`}
                          >
                            {item.value ? (
                              <Check size={17} />
                            ) : (
                              <Clock3 size={17} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p data-scroll-reveal-item className="text-sm font-medium text-[#414141]">
                              {item.label}
                            </p>
                            <p data-scroll-reveal-item className="mt-1 text-xs leading-5 text-[#999999]">
                              {item.detail}
                            </p>
                          </div>
                          <span
                            data-scroll-reveal-item
                            className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
                              item.value
                                ? "text-[#bf5a12]"
                                : "text-[#aaa49a]"
                            }`}
                          >
                            {item.value ? "Ready" : "Pending"}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setActivePage("Constraints")}
                      data-scroll-reveal-item
                      className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e9e8e4] text-sm font-medium text-[#666666] transition hover:bg-[#f7f7f5]"
                    >
                      Review configuration
                      <ArrowRight size={16} />
                    </button>
                  </section>
                </div>
                <div className="order-5">
                  <WorkloadCard timetable={timetable} courses={courses} />
                </div>
              </div>
            )}

            {/* Full timetable */}
            {activePage === "Timetable" && (
              <div className="reveal space-y-5">
              {generationConflict && (
                <section
                  className="dashboard-feature-card rounded-2xl border border-[#f0d6d0] bg-[#fff6f3] p-5"
                  role="alert"
                >
                  <h2 className="text-sm font-semibold text-[#7f3326]">
                    Timetable conflict
                  </h2>
                  <ul className="mt-2 space-y-1 text-sm leading-5 text-[#7f3326]">
                    {generationConflict.constraints.map((constraint) => (
                      <li key={constraint}>{constraint}</li>
                    ))}
                  </ul>
                  {generationConflict.courses.length > 0 && (
                    <p className="mt-2 text-xs text-[#7f3326]">
                      Affected courses: {generationConflict.courses.join(", ")}
                    </p>
                  )}
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[#7f3326]">
                    {generationConflict.suggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openPage("Constraints")}
                      className="rounded-lg border border-[#e5c4ba] px-3 py-2 text-xs font-semibold text-[#7f3326] hover:bg-white"
                    >
                      Review availability preferences
                    </button>
                    <button
                      type="button"
                      onClick={() => openPage("Courses")}
                      className="rounded-lg border border-[#e5c4ba] px-3 py-2 text-xs font-semibold text-[#7f3326] hover:bg-white"
                    >
                      Review courses and rooms
                    </button>
                  </div>
                </section>
              )}

              {pendingSchedule && (
                <section className="dashboard-feature-card rounded-2xl border border-[#e9d7bc] bg-[#fffaf1] p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold">
                        Proposed schedule preview
                      </h2>
                      <p className="mt-1 text-sm text-[#635d53]">
                        Your current timetable stays in place until you apply
                        this proposal.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={applyPendingSchedule}
                        className="h-10 rounded-lg bg-[#ff8a24] px-4 text-sm font-semibold text-[#252523] hover:bg-[#ffa14d]"
                      >
                        Apply preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingSchedule(null)}
                        className="h-10 rounded-lg border border-[#e8e1d6] px-4 text-sm font-medium"
                      >
                        Keep current
                      </button>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-1 text-xs leading-5 text-[#514c43]">
                    {pendingSchedule.changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                  {pendingSchedule.fitSummary.length > 0 && (
                    <div className="mt-4 border-t border-[#eee2d0] pt-3">
                      <h3 className="text-xs font-semibold">
                        Preference fit
                      </h3>
                      <ul className="mt-1 space-y-1 text-xs leading-5 text-[#635d53]">
                        {pendingSchedule.fitSummary.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-5 overflow-hidden rounded-xl border border-[#e9e1d5] bg-white">
                    <h3 className="px-4 pt-4 text-xs font-semibold">
                      Proposed weekly grid
                    </h3>
                    {renderTimetable(false, pendingSchedule.timetable)}
                  </div>
                </section>
              )}

              <section className="dashboard-feature-card overflow-hidden rounded-2xl border border-[#eae9e4] bg-white">
                <div className="flex flex-col justify-between gap-4 border-b border-[#eeeeeb] p-6 sm:flex-row sm:items-center sm:px-8 sm:py-7">
                  <div>
                    <h2 className="text-lg font-semibold sm:text-xl">
                      Monday — Friday
                    </h2>
                    <p className="mt-2 text-sm text-[#999999]">
                      Six periods per day · Weekly academic plan
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={downloadCalendar}
                      disabled={timetable.length === 0}
                      className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e8e1d6] px-3 text-xs font-semibold text-[#514c43] hover:bg-[#f8f5ef] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download size={15} /> Export .ics
                    </button>
                    <button
                      onClick={() => generateTimetable()}
                      disabled={loading}
                      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#242424] px-4 text-sm font-medium text-white transition hover:bg-[#414141] disabled:opacity-60"
                    >
                      {loading ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      {timetable.length > 0 ? "Preview re-plan" : "Generate"}
                    </button>
                  </div>
                </div>

                {timetable.length > 0 ? (
                  renderTimetable(false)
                ) : (
                  <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-14 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0edff] text-[#8375d7]">
                      <CalendarDays size={28} />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold">
                      No timetable yet
                    </h3>
                    <p className="mt-3 max-w-md text-sm leading-7 text-[#999999]">
                      {coursesReady
                        ? "Before generating, review Courses and confirm each course’s weekly periods, faculty, and room. Set availability or timing preferences in Preferences."
                        : "First, add courses with their weekly periods, faculty, and rooms. Then set availability or timing preferences before generating."}
                    </p>
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() =>
                          coursesReady
                            ? generateTimetable()
                            : openPage("Courses")
                        }
                        disabled={loading}
                        className="flex min-h-11 items-center gap-2 rounded-xl bg-[#ff8a24] px-4 py-2 text-sm font-semibold text-[#252523] transition hover:bg-[#ffa14d] focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading ? (
                          <LoaderCircle size={16} className="animate-spin" />
                        ) : coursesReady ? (
                          <WandSparkles size={16} />
                        ) : (
                          <BookOpen size={16} />
                        )}
                        {loading
                          ? "Building schedule…"
                          : coursesReady
                            ? "Generate timetable"
                            : "Configure courses"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#eeeeeb] px-6 py-5 sm:px-8">
                  <span className="text-xs font-medium text-[#888888]">
                    Course key
                  </span>
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      className="flex items-center gap-2 text-xs text-[#777777]"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: course.color }}
                      />
                      {course.name}
                    </div>
                  ))}
                </div>
              </section>
              {timetable.length > 0 && (
                <section className="dashboard-feature-card rounded-2xl border border-[#eae9e4] bg-white p-5 sm:p-6">
                  <h2 className="text-sm font-semibold">Preview a class move</h2>
                  <p className="mt-1 text-xs leading-5 text-[#635d53]">
                    Choose a current class and a new period. The solver will
                    preserve all other hard constraints; nothing changes until
                    you apply the preview above.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label className="text-xs font-medium text-[#635d53]">
                      Class to move
                      <select
                        className="mt-1 h-10 w-full rounded-lg border border-[#e8e1d6] bg-white px-2 text-xs"
                        value={repairSourceIndex}
                        onChange={(event) =>
                          setRepairSourceIndex(Number(event.target.value))
                        }
                      >
                        {timetable.map((entry, index) => (
                          <option key={`${entry.course}-${entry.day}-${entry.slot}-${index}`} value={index}>
                            {entry.course} · {DAYS[getDayIndex(entry.day_name ?? entry.day)]} {PERIODS[entry.slot]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[#635d53]">
                      New day
                      <select
                        className="mt-1 h-10 w-full rounded-lg border border-[#e8e1d6] bg-white px-2 text-sm"
                        value={repairTargetDay}
                        onChange={(event) =>
                          setRepairTargetDay(Number(event.target.value))
                        }
                      >
                        {DAYS.map((day, index) => (
                          <option key={day} value={index}>{day}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[#635d53]">
                      New period
                      <select
                        className="mt-1 h-10 w-full rounded-lg border border-[#e8e1d6] bg-white px-2 text-sm"
                        value={repairTargetSlot}
                        onChange={(event) =>
                          setRepairTargetSlot(Number(event.target.value))
                        }
                      >
                        {PERIODS.map((period, index) => (
                          <option key={period} value={index}>{period}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={loading || timetable.length === 0}
                      onClick={() => {
                        const source = timetable[repairSourceIndex];
                        if (!source) return;
                        const fromDay = getDayIndex(source.day_name ?? source.day);
                        if (
                          fromDay === repairTargetDay &&
                          Number(source.slot) === repairTargetSlot
                        ) {
                          setError("Choose a different day or period for the preview.");
                          return;
                        }
                        void generateTimetable({
                          course: source.course,
                          from_day: fromDay,
                          from_slot: Number(source.slot),
                          to_day: repairTargetDay,
                          to_slot: repairTargetSlot,
                        });
                      }}
                      className="mt-5 h-10 rounded-lg border border-[#e8e1d6] px-3 text-xs font-semibold hover:bg-[#f8f5ef] disabled:opacity-50"
                    >
                      Preview this move
                    </button>
                  </div>
                </section>
              )}
              <WorkloadCard
                timetable={pendingSchedule?.timetable ?? timetable}
                courses={courses}
                title={pendingSchedule ? "Preview workload" : "Weekly workload"}
              />
              {fitSummary.length > 0 && !pendingSchedule && (
                <section className="dashboard-feature-card rounded-xl border border-[#e9e1d5] bg-[#fffdf8] p-4">
                  <h2 className="text-xs font-semibold">How this schedule fits</h2>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-[#635d53]">
                    {fitSummary.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              )}
              </div>
            )}

            {/* Courses */}
            {activePage === "Courses" && (
              <div className="reveal space-y-6">
                <section className="dashboard-feature-card overflow-hidden rounded-2xl border border-[#e8e8df] bg-white">
                  <div className="flex flex-col justify-between gap-4 border-b border-[#eeeeeb] p-6 sm:flex-row sm:items-center sm:px-8 sm:py-7">
                    <div>
                      <h2 className="text-lg font-semibold sm:text-xl">
                        Course catalogue
                      </h2>
                      <p className="mt-2 text-sm text-[#999999]">
                        {courses.length} configured{" "}
                        {courses.length === 1 ? "course" : "courses"} ·{" "}
                        {totalHours} requested weekly periods
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-[#eeeeeb] bg-[#fbfbfa]">
                          {[
                            "COURSE",
                            "PERIODS / WEEK",
                            "FACULTY",
                            "CLASSROOM",
                            "",
                          ].map((heading, index) => (
                            <th
                              key={`${heading}-${index}`}
                              className="px-5 py-4 text-[10px] font-semibold tracking-[0.13em] text-[#a0a0a0] sm:px-6"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {filteredCourses.map((course) => (
                          <tr
                            key={course.id}
                            className="border-b border-[#f0f0ed] last:border-b-0 hover:bg-[#fdfdfb]"
                          >
                            <td className="px-5 py-5 sm:px-6">
                              <div className="flex items-center gap-3.5">
                                <span
                                  className="h-10 w-1.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: course.color,
                                  }}
                                />
                                <input
                                  aria-label="Course name"
                                  value={course.name}
                                  onChange={(event) =>
                                    updateCourse(
                                      course.id,
                                      "name",
                                      event.target.value
                                    )
                                  }
                                  className="w-40 rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm font-semibold outline-none focus:border-[#ded8ff] focus:bg-white"
                                />
                              </div>
                            </td>

                            <td className="px-5 py-5 sm:px-6">
                              <input
                                aria-label="Periods per week"
                                type="number"
                                min={1}
                                max={30}
                                value={course.hours_per_week}
                                onChange={(event) =>
                                  updateCourse(
                                    course.id,
                                    "hours_per_week",
                                    Math.max(1, Number(event.target.value))
                                  )
                                }
                                className="h-10 w-24 rounded-lg border border-[#ecebe7] bg-white px-3 text-sm outline-none focus:border-[#c9c0ff]"
                              />
                            </td>

                            <td className="px-5 py-5 sm:px-6">
                              <input
                                aria-label="Faculty name"
                                value={course.faculty}
                                onChange={(event) =>
                                  updateCourse(
                                    course.id,
                                    "faculty",
                                    event.target.value
                                  )
                                }
                                className="h-10 w-36 rounded-lg border border-transparent bg-transparent px-2 text-sm text-[#777777] outline-none focus:border-[#ded8ff] focus:bg-white"
                              />
                            </td>

                            <td className="px-5 py-5 sm:px-6">
                              <input
                                aria-label="Classroom"
                                value={course.room}
                                onChange={(event) =>
                                  updateCourse(
                                    course.id,
                                    "room",
                                    event.target.value
                                  )
                                }
                                className="h-10 w-32 rounded-lg border border-transparent bg-transparent px-2 text-sm text-[#777777] outline-none focus:border-[#ded8ff] focus:bg-white"
                              />
                            </td>

                            <td className="px-5 py-5 text-right sm:px-6">
                              <button
                                onClick={() => removeCourse(course.id)}
                                aria-label={`Remove ${course.name}`}
                                className="rounded-lg p-2.5 text-[#b4b4b4] transition hover:bg-[#fff0ee] hover:text-[#c85d4c]"
                              >
                                <X size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {filteredCourses.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-6 py-16 text-center text-sm text-[#999999]"
                            >
                              No courses match your search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col justify-between gap-3 border-t border-[#eeeeeb] bg-[#fbfbfa] px-6 py-5 sm:flex-row sm:items-center sm:px-8">
                    <p className="text-xs text-[#999999]">
                      Changes are used the next time you generate your
                      timetable.
                    </p>
                    <button
                      onClick={() => generateTimetable()}
                      disabled={loading}
                      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#242424] px-5 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {loading ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : (
                        <WandSparkles size={16} />
                      )}
                      Generate timetable
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* Faculty */}
            {activePage === "Faculty" && (
              <div className="reveal">
                {filteredFacultyGroups.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredFacultyGroups.map(([faculty, assignedCourses]) => (
                      <div
                        key={faculty}
                        className="dashboard-feature-card rounded-2xl border border-[#eae9e4] bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(30,30,30,0.04)] sm:p-7"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0edff] text-sm font-semibold text-[#8172d7]">
                            {initials(faculty)}
                          </div>
                          <span className="rounded-lg bg-[#f5f4f1] px-3 py-2 text-xs text-[#888888]">
                            {assignedCourses.length}{" "}
                            {assignedCourses.length === 1
                              ? "course"
                              : "courses"}
                          </span>
                        </div>
                        <h3 className="mt-5 text-base font-semibold text-[#333333]">
                          {faculty || "Unassigned"}
                        </h3>
                        <p className="mt-1.5 text-xs text-[#999999]">
                          Faculty member
                        </p>
                        <div className="mt-5 border-t border-[#eeeeeb] pt-4">
                          <p data-scroll-reveal-item className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#aaaaaa]">
                            Assigned courses
                          </p>
                          <div className="space-y-3">
                            {assignedCourses.map((course) => (
                              <div
                                key={course.id}
                                className="flex items-center gap-3"
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: course.color,
                                  }}
                                />
                                <span className="min-w-0 flex-1 truncate text-sm text-[#666666]">
                                  {course.name}
                                </span>
                                <span className="text-xs text-[#aaaaaa]">
                                  {course.hours_per_week} periods
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-feature-card rounded-2xl border border-[#eae9e4] bg-white px-6 py-16 text-center text-sm text-[#999999]">
                    {facultyGroups.length === 0 ? (
                      "No faculty assignments available. Add courses to get started."
                    ) : (
                      <>
                        No faculty match your search.{" "}
                        <button
                          onClick={() => setSearchQuery("")}
                          className="font-semibold text-[#bf5a12] hover:underline"
                        >
                          Clear search
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Rooms */}
            {activePage === "Rooms" && (
              <div className="reveal">
                {filteredRoomGroups.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredRoomGroups.map(([room, assignedCourses]) => (
                      <div
                        key={room}
                        className="dashboard-feature-card rounded-2xl border border-[#eae9e4] bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(30,30,30,0.04)] sm:p-7"
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0df] text-[#bf5a12]"
                          >
                            <DoorOpen size={21} strokeWidth={1.7} />
                          </div>
                          <span className="rounded-lg bg-[#f5f4f1] px-3 py-2 text-xs text-[#888888]">
                            {assignedCourses.length}{" "}
                            {assignedCourses.length === 1
                              ? "course"
                              : "courses"}
                          </span>
                        </div>

                        <h3 className="mt-5 text-base font-semibold text-[#333333]">
                          {room || "Unassigned"}
                        </h3>
                        <p className="mt-1.5 text-xs text-[#999999]">
                          Classroom / laboratory
                        </p>

                        <div className="mt-5 border-t border-[#eeeeeb] pt-4">
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#aaaaaa]">
                            Assigned courses
                          </p>
                          <div className="space-y-3">
                            {assignedCourses.map((course) => (
                              <div
                                key={course.id}
                                className="flex items-center gap-3"
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: course.color,
                                  }}
                                />
                                <span className="min-w-0 flex-1 truncate text-sm text-[#666666]">
                                  {course.name}
                                </span>
                                <span className="text-xs text-[#aaaaaa]">
                                  {course.hours_per_week} periods
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-feature-card rounded-2xl border border-[#eae9e4] bg-white px-6 py-16 text-center text-sm text-[#999999]">
                    {roomGroups.length === 0 ? (
                      "No rooms available. Add courses with room assignments."
                    ) : (
                      <>
                        No rooms match your search.{" "}
                        <button
                          onClick={() => setSearchQuery("")}
                          className="font-semibold text-[#bf5a12] hover:underline"
                        >
                          Clear search
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Constraints */}
            {activePage === "Constraints" && (
              <div className="reveal space-y-6">
                <PreferencesPanel
                  preferences={preferences}
                  courses={courses}
                  saved={preferencesSaved}
                  saveError={storageError}
                  onChange={(next) => {
                    setPendingSchedule(null);
                    setPreferences(next);
                    setPreferencesSaved(false);
                  }}
                />
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="dashboard-feature-card rounded-2xl border border-[#eae9e4] bg-white p-6 sm:p-8">
                  <div className="mb-7 flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] text-[#8172d7]">
                      <Settings2 size={22} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold sm:text-xl">
                        Scheduler configuration
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[#999999]">
                        Current parameters sent to the timetable generator.
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-[#e8e8df]">
                    {[
                      {
                        label: "Scheduling days",
                        value: "Monday – Friday",
                        detail: "Sent as five days in the generate request",
                      },
                      {
                        label: "Periods per day",
                        value: "6 periods",
                        detail: "Sent as slots_per_day: 6",
                      },
                      {
                        label: "Courses configured",
                        value: `${courses.length} courses`,
                        detail: "Current editable course list",
                      },
                      {
                        label: "Weekly periods requested",
                        value: `${totalHours} periods`,
                        detail: "Sum of configured weekly course periods",
                      },
                      {
                        label: "Faculty assignments",
                        value: `${uniqueFaculty} assigned`,
                        detail: "Distinct faculty names on configured courses",
                      },
                      {
                        label: "Room assignments",
                        value: `${uniqueRooms} assigned`,
                        detail: "Distinct rooms on configured courses",
                      },
                      {
                        label: "API endpoint",
                        value: API_ENDPOINT,
                        detail: "Configured in the current frontend",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center sm:gap-6"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[#44453f]">
                            {item.label}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-[#8a8b83]">
                            {item.detail}
                          </p>
                        </div>
                        <span className="max-w-full break-all text-left text-[12px] font-medium text-[#4b4c45] sm:shrink-0 sm:text-right">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="space-y-4">
                  <section className="dashboard-feature-card rounded-2xl border border-[#eae9e4] bg-white p-6 sm:p-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4e5] text-[#c28b43]">
                      <Clock3 size={22} />
                    </div>
                    <h2 className="mt-4 text-base font-semibold">
                      About scheduling rules
                    </h2>
                    <p className="closing-copy mt-2 text-[12px] leading-6 text-[#85867f]">
                      Chronos combines course hours, faculty, room assignments,
                      and your preferences into one workable weekly plan. It
                      keeps classes from overlapping and balances your week
                      around the unavailable times and preferred windows you set.
                      Preview the result, adjust what matters, and keep the
                      <span className="closing-copy__emphasis"> schedule that fits your campus best.</span>
                    </p>
                    <div className="mt-4 rounded-lg bg-[#faf9f6] px-3.5 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#92938b]">
                        Period times in the current grid
                      </p>
                      <p className="mt-1.5 text-xs font-medium text-[#55564f]">
                        {PERIODS.join(" · ")}
                      </p>
                    </div>
                  </section>

                </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <footer className="mt-12 flex flex-col justify-between gap-3 border-t border-[#e8e7e2] pt-6 text-[11px] text-[#a1a09a] sm:mt-14 sm:flex-row sm:items-center">
              <p>CHRONOS · ACADEMIC SCHEDULING WORKSPACE</p>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    generated ? "bg-[#53b6a0]" : "bg-[#d8b77b]"
                  }`}
                />
                <span>
                  {generated
                    ? "Timetable generated"
                    : "Ready to configure your week"}
                </span>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
