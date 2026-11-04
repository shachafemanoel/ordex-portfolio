'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BellRing, Lock, ShieldCheck, Smartphone } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import {
  StitchPageHeader,
  StitchPageShell,
  StitchPanel,
  StitchTabButton,
} from '@/components/stitch/StitchShell';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatusChip } from '@/components/ui/StatusChip';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/ToastProvider';
import apiClient from '@/lib/apiClient';

type ProfileTab = 'profile' | 'security' | 'notifications';

type NotificationSetting = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: typeof BellRing;
};

interface ProfileSidebarProps {
  userEmail: string;
  roleLabel: string;
  roleKey: string;
  emailAlerts: boolean;
  pushAlerts: boolean;
  smartAutomation: boolean;
  onEmailAlertsChange: (value: boolean) => void;
  onPushAlertsChange: (value: boolean) => void;
  onSmartAutomationChange: (value: boolean) => void;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}

function ProfileSidebar({
  userEmail,
  roleLabel,
  roleKey,
  emailAlerts,
  pushAlerts,
  smartAutomation,
  onEmailAlertsChange,
  onPushAlertsChange,
  onSmartAutomationChange,
  onRefresh,
  onLogout,
}: ProfileSidebarProps) {
  const settings: NotificationSetting[] = [
    {
      label: 'התראות מייל',
      description: 'קבלת עדכונים יומיים והתראות תפעול במייל',
      checked: emailAlerts,
      onChange: onEmailAlertsChange,
      icon: BellRing,
    },
    {
      label: 'התראות Push',
      description: 'התראות בזמן אמת בדפדפן',
      checked: pushAlerts,
      onChange: onPushAlertsChange,
      icon: Smartphone,
    },
    {
      label: 'יישום אוטומטי',
      description: 'הפעלת המלצות חכמות למסכים תפעוליים',
      checked: smartAutomation,
      onChange: onSmartAutomationChange,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <StitchPanel
        title="הגדרות התראות"
        description="ניהול התראות שמגיעות למייל, דפדפן ופעולות אוטומטיות."
      >
        <div className="space-y-4">
          {settings.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="surface-subtle flex items-start justify-between p-4">
                <div className="flex items-start gap-3">
                  <div className="tone-accent flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[var(--color-text-primary)]">
                      {item.label}
                    </div>
                    <div className="text-xs font-medium text-[var(--color-text-secondary)]">
                      {item.description}
                    </div>
                  </div>
                </div>
                <Switch checked={item.checked} onCheckedChange={item.onChange} />
              </div>
            );
          })}
        </div>
      </StitchPanel>

      <StitchPanel title="זיהוי משתמש" description="פרטי חיבור והרשאות במסך הנוכחי.">
        <div className="tone-warning rounded-[22px] p-4">
          <div className="text-sm font-bold text-[var(--color-text-primary)]">{userEmail}</div>
          <div className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">
            מחובר עם הרשאות {roleLabel || roleKey}
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => void onRefresh()}>
            רענן נתונים
          </Button>
          <Button variant="destructive" className="flex-1" onClick={() => void onLogout()}>
            התנתק
          </Button>
        </div>
      </StitchPanel>
    </div>
  );
}

interface ProfileDetailsPanelProps {
  userName: string;
  userEmail: string;
  roleLabel: string;
  roleKey: string;
  name: string;
  phone: string;
  savingProfile: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
}

function ProfileDetailsPanel({
  userName,
  userEmail,
  roleLabel,
  roleKey,
  name,
  phone,
  savingProfile,
  onNameChange,
  onPhoneChange,
  onSubmit,
}: ProfileDetailsPanelProps) {
  return (
    <StitchPanel title="הגדרות פרופיל" description="עדכון פרטי משתמש, פרטי קשר ופרטי התחברות.">
      <form className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
        <div className="surface-subtle flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="tone-accent flex h-16 w-16 items-center justify-center rounded-[24px] text-xl font-black">
              {userName.charAt(0) || userEmail.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-bold text-[var(--color-text-primary)]">
                {userName || 'ללא שם'}
              </div>
              <div className="text-sm font-medium text-[var(--color-text-secondary)]">
                {userEmail}
              </div>
            </div>
          </div>
          <Button type="submit" loading={savingProfile} disabled={savingProfile}>
            שמור שינויים
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="שם מלא" required>
            <Input value={name} onChange={(event) => onNameChange(event.target.value)} />
          </FormField>

          <FormField label="אימייל" description="אימייל לא ניתן לשינוי" required>
            <Input value={userEmail} disabled />
          </FormField>

          <FormField label="תפקיד">
            <Input value={roleLabel || roleKey} disabled />
          </FormField>

          <FormField label="טלפון">
            <Input value={phone} onChange={(event) => onPhoneChange(event.target.value)} />
          </FormField>
        </div>
      </form>
    </StitchPanel>
  );
}

interface PasswordPanelProps {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  savingPassword: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
}

function PasswordPanel({
  currentPassword,
  newPassword,
  confirmPassword,
  savingPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: PasswordPanelProps) {
  return (
    <StitchPanel title="שינוי סיסמה" description="החלפת סיסמה באמצעות הזדהות עם הסיסמה הנוכחית.">
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="סיסמה נוכחית" required>
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => onCurrentPasswordChange(event.target.value)}
            />
          </FormField>

          <FormField label="סיסמה חדשה" required>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => onNewPasswordChange(event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="אימות סיסמה חדשה" required>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
          />
        </FormField>

        <div className="surface-subtle p-4 text-xs font-medium text-[var(--color-text-secondary)]">
          <div className="mb-1 flex items-center gap-2 font-bold text-[var(--color-text-primary)]">
            <Lock className="h-4 w-4 text-[var(--color-accent-500)]" />
            אבטחה מומלצת
          </div>
          השתמש בסיסמה ייחודית הכוללת אותיות, מספרים וסימנים מיוחדים.
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="outline" loading={savingPassword} disabled={savingPassword}>
            עדכן סיסמה
          </Button>
        </div>
      </form>
    </StitchPanel>
  );
}

export function UserProfilePageContainer() {
  const { user, loading, refresh, logout } = useAuth();
  const { success: showSuccess, error: showError, info: showInfo } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(false);
  const [smartAutomation, setSmartAutomation] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }

    setName(user.name || user.fullName || '');
    setPhone(user.phone || '');
  }, [user]);

  const roleLabel = useMemo(() => {
    if (!user) {
      return '';
    }

    if (typeof user.role === 'string') {
      return user.role;
    }

    return user.role?.label || user.role?.key || '';
  }, [user]);

  const roleKey = useMemo(() => {
    if (!user) {
      return '';
    }

    return typeof user.role === 'string' ? user.role : user.role?.key || '';
  }, [user]);

  const userStatus = typeof user?.status === 'string' ? user.status : 'active';

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    setSavingProfile(true);
    try {
      const response = await apiClient.patch('/api/auth/me', { name, phone });
      if (!response.success) {
        throw new Error(response.error?.message || 'שמירת הפרופיל נכשלה');
      }

      showSuccess('הפרופיל עודכן בהצלחה');
      await refresh();
    } catch (error) {
      showError('שמירת הפרופיל נכשלה', error instanceof Error ? error.message : undefined);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('הסיסמאות אינן תואמות');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await apiClient.patch('/api/auth/me', {
        currentPassword,
        newPassword,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'עדכון הסיסמה נכשל');
      }

      showSuccess('הסיסמה עודכנה בהצלחה');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveTab('security');
    } catch (error) {
      showError('עדכון הסיסמה נכשל', error instanceof Error ? error.message : undefined);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    showInfo('התנתקת בהצלחה');
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="טוען פרטי חשבון..." />;
  }

  if (!user) {
    return (
      <div className="p-6">
        <StitchPageShell>
          <StitchPanel title="לא נמצאו פרטי משתמש">
            <div className="space-y-4 text-right">
              <p className="text-sm text-[var(--color-text-secondary)]">
                נסה להתחבר מחדש כדי לטעון את הפרופיל.
              </p>
              <Button onClick={() => router.push('/login')}>חזור להתחברות</Button>
            </div>
          </StitchPanel>
        </StitchPageShell>
      </div>
    );
  }

  return (
    <StitchPageShell>
      <StitchPageHeader
        title="הגדרות פרופיל"
        description="ניהול פרטי החשבון, אמצעי אבטחה והעדפות ההתראות של המשתמש."
        meta={
          <>
            <StatusChip status={userStatus} variant="installation" />
            <span className="rounded-full border border-[var(--color-border-primary)] bg-[var(--card-bg)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              {roleLabel || roleKey}
            </span>
          </>
        }
        tabs={
          <>
            <StitchTabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')}>
              פרטים אישיים
            </StitchTabButton>
            <StitchTabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')}>
              אבטחה
            </StitchTabButton>
            <StitchTabButton
              active={activeTab === 'notifications'}
              onClick={() => setActiveTab('notifications')}
            >
              התראות
            </StitchTabButton>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <ProfileSidebar
          userEmail={user.email}
          roleLabel={roleLabel}
          roleKey={roleKey}
          emailAlerts={emailAlerts}
          pushAlerts={pushAlerts}
          smartAutomation={smartAutomation}
          onEmailAlertsChange={setEmailAlerts}
          onPushAlertsChange={setPushAlerts}
          onSmartAutomationChange={setSmartAutomation}
          onRefresh={refresh}
          onLogout={handleLogout}
        />

        <div className="space-y-6">
          <ProfileDetailsPanel
            userName={user.name || user.fullName || ''}
            userEmail={user.email}
            roleLabel={roleLabel}
            roleKey={roleKey}
            name={name}
            phone={phone}
            savingProfile={savingProfile}
            onNameChange={setName}
            onPhoneChange={setPhone}
            onSubmit={handleProfileSave}
          />
          <PasswordPanel
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            savingPassword={savingPassword}
            onCurrentPasswordChange={setCurrentPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onSubmit={handlePasswordSave}
          />
        </div>
      </div>
    </StitchPageShell>
  );
}
