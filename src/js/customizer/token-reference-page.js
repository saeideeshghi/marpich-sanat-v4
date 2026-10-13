import "../../css/fonts.css";
import "../../css/token-reference.css";
import { createTokenReference, tokenStats } from "./token-reference.js";

for (const [id, value] of [
    ["token-total", tokenStats.total],
    ["token-groups", tokenStats.groups],
    ["token-editable", tokenStats.editable],
])
    document.getElementById(id).textContent = value.toLocaleString("fa");
createTokenReference({ container: document.getElementById("token-reference") });
