import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    // Mock Prisma 7 generated client — uses ESM import.meta.url which Jest can't parse
    "^@/generated/prisma/client$": "<rootDir>/src/__mocks__/prismaGeneratedClient.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
};

export default config;
