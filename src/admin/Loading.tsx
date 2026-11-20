import { motion } from 'motion/react';
import { useT } from '../i18n';

export function Loading() {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh items-center justify-center text-ink-400">
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4 }}>
        {t('loading')}
      </motion.div>
    </div>
  );
}
