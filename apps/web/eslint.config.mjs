import next from "eslint-config-next";

// eslint-config-next 16 já exporta um flat config pronto (array).
const config = [...next, { ignores: [".next/**", "node_modules/**"] }];

export default config;
