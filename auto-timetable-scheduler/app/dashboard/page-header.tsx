import type { ReactNode } from "react";
import Image from "next/image";
import styles from "./page-header.module.css";

type DashboardPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  controls?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  visualSrc?: string;
};

export default function DashboardPageHeader({
  eyebrow,
  title,
  description,
  controls,
  metadata,
  actions,
  visualSrc = "/images/lecture-hall.jpg",
}: DashboardPageHeaderProps) {
  return (
    <header className={styles.container} aria-labelledby="dashboard-page-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 id="dashboard-page-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.description}>{description}</p>
        {controls && <div className={styles.controls}>{controls}</div>}
      </div>

      <div className={styles.visual} aria-hidden="true">
        <div className={styles.visualCaption}>
          <span className={styles.visualDot} />
          CAMPUS, IN VIEW
        </div>
        <Image
          className={styles.photo}
          src={visualSrc}
          alt=""
          fill
          sizes="(max-width: 760px) 100vw, 45vw"
          priority
        />
        <div className={styles.visualBadge}>
          <span>5</span>
          <small>days<br />at a glance</small>
        </div>
      </div>

      {(metadata || actions) && (
        <div className={styles.right}>
          {metadata && <div className={styles.metadata}>{metadata}</div>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
    </header>
  );
}
