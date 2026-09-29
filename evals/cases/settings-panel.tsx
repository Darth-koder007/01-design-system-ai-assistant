import { Input } from "@ds/components";

export function SettingsPanel() {
  return (
    <section>
      <Input label="Display name" />

      <label htmlFor="locale">Locale</label>
      <select id="locale" name="locale" defaultValue="en">
        <option value="en">English</option>
        <option value="de">Deutsch</option>
      </select>
    </section>
  );
}
