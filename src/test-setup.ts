import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sem `globals: true` o cleanup automatico do Testing Library nao se registra,
// e cada teste herda o DOM do anterior. Registrar a mao mantem a config
// explicita e o isolamento intacto.
afterEach(cleanup);
