import { Zap, Smartphone, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

const FEATURE_CARDS = [
  {
    icon: <Zap className="w-6 h-6 text-primary-600" />,
    title: 'מהיר ותכליתי',
    description: 'ללא תפריטים מסורבלים. צור הזמנה חדשה ב-3 לחיצות והמשך ביום העבודה שלך.',
  },
  {
    icon: <Smartphone className="w-6 h-6 text-primary-600" />,
    title: 'מותאם אישית לנייד',
    description: 'תואם ישר מהקופסה לטלפון של בעל העסק בשטח. טקסטים גדולים ונוחים ב-RTL (ממשק עברית מלא).',
  },
  {
    icon: <CheckCircle2 className="w-6 h-6 text-primary-600" />,
    title: 'מעקב סטטוסים מלא',
    description: 'דע תמיד איפה כל הזמנה עומדת – מהצעה ועד התקנה וסיום, עם ניהול פשוט ואינטואיטיבי.',
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h2 className="mb-4 text-3xl font-bold text-[var(--text-primary)] [font-family:var(--font-display)] sm:text-4xl">
          למה דווקא רצף?
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-[var(--text-secondary)]">
          בנינו את המערכת בדיוק בשביל לענות על הצרכים של העסק שלך בתנועה, ולחסוך לך זמן יקר בכל יום.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {FEATURE_CARDS.map((feature, idx) => (
          <Card
            key={idx}
            className="flex h-full flex-col items-start gap-4 p-8 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]"
          >
            <div className="surface-subtle flex h-12 w-12 items-center justify-center rounded-xl">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)] [font-family:var(--font-display)]">{feature.title}</h3>
            <p className="text-base leading-relaxed text-[var(--text-secondary)]">
              {feature.description}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
