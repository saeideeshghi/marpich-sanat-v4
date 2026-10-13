/* Single registry for Vite entries, navigation state and structural checks.
 * Add a page here together with its root HTML and page CSS/JS; no runtime routing.
 */
export const pages = [
    { name: "home", file: "index.html", activeNav: "home" },
    { name: "products", file: "products.html", activeNav: "products" },
    { name: "product-details", file: "product-details.html", activeNav: "products" },
    { name: "contact", file: "contact.html", activeNav: "contact" },
    { name: "project-details", file: "project-details.html", activeNav: "projects" },
    { name: "about", file: "about.html", activeNav: "about" },
    { name: "projects", file: "projects.html", activeNav: "projects" },
    { name: "industry-textile", file: "industry-textile.html", activeNav: "industries" },
    { name: "expertise", file: "expertise.html", activeNav: "expertise" },
    { name: "air-handling", file: "air-handling.html", activeNav: "products" },
    { name: "industries", file: "industries.html", activeNav: "industries" },
    { name: "articles", file: "articles.html", activeNav: "articles" },
];
