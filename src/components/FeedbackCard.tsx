// components/FeedbackCard.tsx
import { cardPresets } from "@/styles/cardPresets";

type FeedbackCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function FeedbackCard({ title, subtitle, children, footer }: FeedbackCardProps) {
  const styles = cardPresets.feedback;
  return (
    <div className={styles.base}>
      <div className={styles.header}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm opacity-90">{subtitle}</p>}
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
