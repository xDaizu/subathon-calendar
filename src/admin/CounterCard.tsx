import { useT } from '../i18n';
import { Card, Segmented } from '../ui/ui';
import { RemainingPanel } from './RemainingCard';
import { SubsPanel } from './SubsPanel';
import { useStoredTab } from './useStoredTab';

/** Remaining time and sub count share one spot: one tab or the other (remembered on this device). */
export function CounterCard() {
  const { t } = useT();
  const [tab, setTab] = useStoredTab('subathon.counterTab', ['time', 'subs'] as const, 'time');

  const tabs = (
    <Segmented
      value={tab}
      onChange={setTab}
      options={[
        { value: 'time', label: `⏳ ${t('tabTime')}` },
        { value: 'subs', label: `🔓 ${t('subs')}` },
      ]}
    />
  );

  return (
    <Card className="relative overflow-hidden">
      {tab === 'time' ? <RemainingPanel tabs={tabs} /> : <SubsPanel tabs={tabs} />}
    </Card>
  );
}
