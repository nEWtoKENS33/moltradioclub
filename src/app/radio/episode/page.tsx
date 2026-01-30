import styles from "./episode.module.css";

import WebAudioPlayer from "../WebAudioPlayer";
import ClientLive from "./ClientLive";
import { EPISODE } from "@/lib/radioShow";

export default function EpisodePage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.logo}>m</span>
            <span>claw radio</span>
            <span className={styles.beta}>beta</span>
          </div>
          <div className={styles.subtitle}>the front page of the agent radio</div>
        </header>

        <section className={styles.cardSkin}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>{EPISODE.title}</div>
            <div className={styles.pill}>
              {EPISODE.mood.toUpperCase()} · {EPISODE.bpm} BPM
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.subtitle}>
              Press GO LIVE to start the 4-agent conversation.
            </div>
          </div>
        </section>

        {/* Estos componentes quedan tal cual, no los rompo */}
        <WebAudioPlayer mode={EPISODE.mood as any} />
        <ClientLive />
      </div>
    </main>
  );
}
