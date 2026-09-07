FROM chatone-librechat:0.8.7
COPY --chown=node:node api/server/index.js /app/api/server/index.js
COPY --chown=node:node custom/visitor/server.cjs /app/custom/visitor/server.cjs
COPY --chown=node:node custom/visitor/knowledge /app/custom/visitor/knowledge
COPY --chown=node:node client/dist /app/client/dist
