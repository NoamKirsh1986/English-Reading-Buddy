const LANGUAGES = [
  { code: 'Hebrew', label: 'Hebrew (\u05E2\u05D1\u05E8\u05D9\u05EA)' },
  { code: 'Spanish', label: 'Spanish (Espa\u00F1ol)' },
  { code: 'Arabic', label: 'Arabic (\u0627\u0644\u0639\u0631\u0628\u064A\u0629)' },
  { code: 'Russian', label: 'Russian (\u0420\u0443\u0441\u0441\u043A\u0438\u0439)' },
  { code: 'Chinese', label: 'Chinese (\u4E2D\u6587)' },
  { code: 'French', label: 'French (Fran\u00E7ais)' },
  { code: 'Portuguese', label: 'Portuguese (Portugu\u00EAs)' },
  { code: 'Japanese', label: 'Japanese (\u65E5\u672C\u8A9E)' },
  { code: 'Korean', label: 'Korean (\uD55C\uAD6D\uC5B4)' },
  { code: 'Hindi', label: 'Hindi (\u0939\u093F\u0928\u094D\u0926\u0940)' },
  { code: 'Turkish', label: 'Turkish (T\u00FCrk\u00E7e)' },
  { code: 'German', label: 'German (Deutsch)' },
];

function LanguageSelector({ value, onChange }) {
  return (
    <div className="language-selector">
      <label htmlFor="language">My language:</label>
      <select
        id="language"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSelector;
