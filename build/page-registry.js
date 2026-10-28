import { resolve } from "node:path";
import { allPages } from "./pages.js";
export const pageForFile = (root, filename) =>
    allPages.find((page) => resolve(root, page.file) === resolve(root, filename));
