ARG CHATONE_UI_IMAGE=chatone-librechat:ui-widget-20260907
FROM ${CHATONE_UI_IMAGE}
COPY --chown=node:node api/server/index.js /app/api/server/index.js
COPY --chown=node:node custom/visitor/server.cjs /app/custom/visitor/server.cjs
COPY --chown=node:node custom/visitor/knowledge /app/custom/visitor/knowledge
