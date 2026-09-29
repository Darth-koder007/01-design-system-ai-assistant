export function LoginForm({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className="login-card">
      <h2>Welcome back</h2>
      <input type="text" placeholder="Username" name="username" />
      <input type="password" placeholder="Password" name="password" />
      <button onClick={onSubmit}>Log in</button>
    </div>
  );
}
