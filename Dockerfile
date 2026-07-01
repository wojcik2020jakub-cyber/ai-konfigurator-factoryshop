FROM node:20-slim

# Nástroje pro native addons (Sharp, canvas apod.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Závislosti – instalujeme před kopírováním kódu (cache vrstva)
COPY package*.json ./
RUN npm ci --omit=dev

# Zdrojový kód
COPY . .

# Složka pro výstupní soubory (PDF, SVG)
RUN mkdir -p output

EXPOSE 3020

CMD ["node", "server/index.js"]
