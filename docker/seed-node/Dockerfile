FROM localchain:latest

ENV NODE_NAME=seed-node
ENV CHAIN_HOME=/root/.localchaind

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
