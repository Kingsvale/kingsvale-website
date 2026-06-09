import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [".next/**", "node_modules/**", "dist-server/**", "tsconfig.tsbuildinfo"]
  },
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    rules: {
      "import/no-anonymous-default-export": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off"
    }
  }
];

export default config;
