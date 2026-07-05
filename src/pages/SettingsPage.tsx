import { useSettings, type Settings } from '../hooks/useSettings';

interface Option<K extends keyof Settings> {
  value: Settings[K];
  label: string;
  hint?: string;
}

function OptionGroup<K extends keyof Settings>({
  title,
  name,
  options,
  value,
  onChange,
}: {
  title: string;
  name: K;
  options: Option<K>[];
  value: Settings[K];
  onChange: (v: Settings[K]) => void;
}) {
  return (
    <fieldset className="settings-card">
      <legend className="title-sm">{title}</legend>
      <div className="settings-options">
        {options.map((opt) => (
          <label
            key={String(opt.value)}
            className={`settings-option${value === opt.value ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name={String(name)}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span className="settings-option-text">
              <span className="body-strong">{opt.label}</span>
              {opt.hint && <span className="caption settings-option-hint">{opt.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function SettingsPage() {
  const { settings, update } = useSettings();

  return (
    <div className="container page page-narrow">
      <header className="page-header">
        <div>
          <h1 className="display-lg">Settings</h1>
          <p className="body-sm page-header-sub">Preferences save automatically to this browser.</p>
        </div>
      </header>

      <div className="settings-stack">
        <OptionGroup
          title="Appearance"
          name="theme"
          value={settings.theme}
          onChange={(v) => update({ theme: v })}
          options={[
            { value: 'system', label: 'System', hint: 'Follow the OS light/dark preference' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <OptionGroup
          title="Character display"
          name="characterPriority"
          value={settings.characterPriority}
          onChange={(v) => update({ characterPriority: v })}
          options={[
            { value: 'simplified', label: 'Simplified first', hint: '银行 · trad. shown as variant' },
            { value: 'traditional', label: 'Traditional first', hint: '銀行 · simp. shown as variant' },
            { value: 'both', label: 'Both equally', hint: '银行 / 銀行' },
          ]}
        />
        <OptionGroup
          title="Pinyin display"
          name="pinyinStyle"
          value={settings.pinyinStyle}
          onChange={(v) => update({ pinyinStyle: v })}
          options={[
            { value: 'marks', label: 'Tone marks', hint: 'yínháng' },
            { value: 'numbers', label: 'Tone numbers', hint: 'yin2hang2' },
          ]}
        />
        <OptionGroup
          title="Headword size"
          name="headwordSize"
          value={settings.headwordSize}
          onChange={(v) => update({ headwordSize: v })}
          options={[
            { value: 'default', label: 'Default' },
            { value: 'large', label: 'Large', hint: 'Bigger characters on results and entries' },
          ]}
        />
      </div>
    </div>
  );
}
