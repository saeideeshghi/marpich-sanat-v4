// Page behavior; the head loads styles before this module.
import { initSite } from "../main.js";
import { setupProductsMotion } from "./products-motion.integration.js";

initSite();
setupProductsMotion();
