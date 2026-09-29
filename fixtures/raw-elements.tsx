export function SignupForm() {
  return (
    <form>
      <input type="text" name="name" />
      <input type="checkbox" name="agree" />
      <input type="radio" name="plan" value="free" />
      <select name="country">
        <option value="de">Germany</option>
      </select>
      <button type="submit">Sign up</button>
    </form>
  );
}
