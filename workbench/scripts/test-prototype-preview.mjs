import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import assert from "node:assert/strict";
const server=await createServer({configFile:false,plugins:[react()],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:"custom"});
try{const {default:Preview}=await server.ssrLoadModule("/src/PrototypePreview.jsx");const html=renderToStaticMarkup(React.createElement(Preview));for(const text of ["预览原型","小哥端","本机演示数据","新窗口打开","返回需求"])assert(html.includes(text));assert(html.includes("/prototype-preview/courier.html#page=courier.home"));assert(!html.includes("127.0.0.1:5173"));console.log("PASS: same-origin courier prototype preview");}finally{await server.close();}
