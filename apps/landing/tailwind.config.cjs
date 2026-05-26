/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glass: "0 24px 80px rgba(15, 23, 42, 0.10)",
        glow: "0 30px 100px rgba(6, 182, 212, 0.22)"
      }
    }
  },
  plugins: [],
};
