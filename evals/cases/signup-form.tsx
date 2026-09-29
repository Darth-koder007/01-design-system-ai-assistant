import { useState } from "react";

export function SignupForm() {
  const [agreed, setAgreed] = useState(false);

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" name="email" required />

      <label htmlFor="password">Password</label>
      <input id="password" type="password" name="password" required />

      <input
        type="checkbox"
        name="agree"
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
      />

      <button type="submit" disabled={!agreed}>
        Create account
      </button>
    </form>
  );
}
