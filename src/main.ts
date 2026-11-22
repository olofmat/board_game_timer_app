import "./style.css";
import { APP_NAME, placeholderMessage } from "./appInfo";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app element missing from index.html");

const heading = document.createElement("h1");
heading.textContent = APP_NAME;
const message = document.createElement("p");
message.textContent = placeholderMessage();
app.replaceChildren(heading, message);
