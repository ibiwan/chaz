"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
const jsx_runtime_1 = require("react/jsx-runtime");
require("./globals.css");
exports.metadata = {
    title: 'Chaz Full-Stack Starter',
    description: 'Frontend + backend TypeScript starter for Vercel',
};
function RootLayout({ children }) {
    return ((0, jsx_runtime_1.jsx)("html", { lang: "en", children: (0, jsx_runtime_1.jsx)("body", { children: children }) }));
}
